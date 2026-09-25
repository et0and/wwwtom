import { Effect, Schema } from "effect";
import {
  CrmAssetInputSchema,
  CrmAssetSchema,
  CrmAssetUpdateSchema,
  CrmAssetVersionInputSchema,
  CrmLocationInputSchema,
  CrmLocationUpdateSchema,
  CrmLocationSchema,
  CrmPhotoSchema,
  type CrmAsset,
  type CrmPaging,
  type CrmAssetInput,
  type CrmAssetListResponse,
  type CrmAssetUpdate,
  type CrmLocationUpdate,
  type CrmLocation,
  type CrmLocationInput,
  type CrmPhoto,
} from "@tom/schemas/crm";
import { CmsError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import type { CmsD1Binding, CmsR2Binding } from "@tom/utils/services/config";

const ASSET_COLUMNS =
  "id, name, serial_number AS serialNumber, description, category, status, location, hash, version, mutation_id AS mutationId, created_by AS createdBy, created_at AS createdAt, updated_at AS updatedAt";
const PHOTO_COLUMNS =
  "id, asset_id AS assetId, original_name AS originalName, mime, byte_size AS byteSize, sha256, object_key AS objectKey, created_at AS createdAt";
const LOCATION_COLUMNS =
  "id, asset_id AS assetId, location, note, logged_by AS loggedBy, created_at AS createdAt";

const AssetRowSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  serialNumber: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  category: Schema.String,
  status: Schema.Literals(["available", "in-use", "maintenance", "retired"]),
  location: Schema.NullOr(Schema.String),
  hash: Schema.String,
  version: Schema.Int,
  mutationId: Schema.NullOr(Schema.String),
  createdBy: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

const PhotoRowSchema = Schema.Struct({
  id: Schema.String,
  assetId: Schema.String,
  originalName: Schema.String,
  mime: Schema.String,
  byteSize: Schema.Finite,
  sha256: Schema.String,
  objectKey: Schema.String,
  createdAt: Schema.String,
});

const LocationRowSchema = Schema.Struct({
  id: Schema.String,
  assetId: Schema.String,
  location: Schema.String,
  note: Schema.NullOr(Schema.String),
  loggedBy: Schema.String,
  createdAt: Schema.String,
});

export type CrmPhotoUpload = {
  readonly name: string;
  readonly mime: string;
  readonly bytes: ArrayBuffer;
  readonly digest: ArrayBuffer;
  readonly sha256: string;
};

type AssetRow = typeof AssetRowSchema.Type;
type PhotoRow = typeof PhotoRowSchema.Type;
type LocationRow = typeof LocationRowSchema.Type;

const queryAll = (
  db: CmsD1Binding,
  sql: string,
  params: ReadonlyArray<string | number | null>,
  operation: string,
): Effect.Effect<ReadonlyArray<unknown>, CmsError> =>
  Effect.tryPromise({
    try: () =>
      db
        .prepare(sql)
        .bind(...params)
        .all<unknown>(),
    catch: (cause) =>
      new CmsError({
        message: "CRM query failed",
        status: HttpStatus.InternalServerError,
        operation,
        cause,
      }),
  }).pipe(Effect.map((result) => result.results));

const queryFirst = (
  db: CmsD1Binding,
  sql: string,
  params: ReadonlyArray<string | number | null>,
  operation: string,
): Effect.Effect<unknown | null, CmsError> =>
  Effect.tryPromise({
    try: () =>
      db
        .prepare(sql)
        .bind(...params)
        .first<unknown>(),
    catch: (cause) =>
      new CmsError({
        message: "CRM query failed",
        status: HttpStatus.InternalServerError,
        operation,
        cause,
      }),
  });

const runStatement = (
  db: CmsD1Binding,
  sql: string,
  params: ReadonlyArray<string | number | null>,
  operation: string,
): Effect.Effect<void, CmsError> =>
  Effect.tryPromise({
    try: () =>
      db
        .prepare(sql)
        .bind(...params)
        .run(),
    catch: (cause) =>
      new CmsError({
        message: "CRM write failed",
        status: HttpStatus.InternalServerError,
        operation,
        cause,
      }),
  }).pipe(Effect.asVoid);

const decode = <A, I, B>(
  schema: Schema.Codec<A, I>,
  value: B,
  operation: string,
): Effect.Effect<A, CmsError> =>
  Schema.decodeUnknownEffect(schema)(value).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message: "Invalid CRM data",
          status: HttpStatus.InternalServerError,
          operation,
          cause,
        }),
    ),
  );

const runBatch = (
  db: CmsD1Binding,
  statements: ReadonlyArray<ReturnType<CmsD1Binding["prepare"]>>,
  operation: string,
): Effect.Effect<
  ReadonlyArray<{
    readonly success: boolean;
    readonly meta?: { readonly changes?: number };
  }>,
  CmsError
> =>
  Effect.tryPromise({
    try: () => db.batch(statements),
    catch: (cause) =>
      new CmsError({
        message: "CRM batch write failed",
        status: HttpStatus.InternalServerError,
        operation,
        cause,
      }),
  });

const photoObjectKey = (assetId: string, photoId: string, name: string): string =>
  `assets/${assetId}/${photoId}/${name}`;

const cleanupR2Objects = (r2: CmsR2Binding, keys: ReadonlyArray<string>): Effect.Effect<void> =>
  Effect.forEach(
    keys,
    (key) =>
      Effect.tryPromise({
        try: () => r2.delete(key),
        catch: () => undefined,
      }).pipe(Effect.ignore),
    { concurrency: 1 },
  );

const requireAssetRow = (
  db: CmsD1Binding,
  id: string,
  operation: string,
): Effect.Effect<AssetRow, CmsError> =>
  Effect.gen(function* () {
    const value = yield* queryFirst(
      db,
      `SELECT ${ASSET_COLUMNS} FROM crm_assets WHERE id = ?`,
      [id],
      operation,
    );
    if (value === null) {
      return yield* new CmsError({
        message: "Asset not found",
        status: HttpStatus.NotFound,
        operation,
      });
    }
    return yield* decode(AssetRowSchema, value, operation);
  });

const concurrentModification = (operation: string): CmsError =>
  new CmsError({
    message: "Asset changed while it was being updated",
    status: HttpStatus.Conflict,
    operation,
  });

const assertConditionalUpdate = (
  results: ReadonlyArray<{
    readonly success: boolean;
    readonly meta?: { readonly changes?: number };
  }>,
  operation: string,
): Effect.Effect<void, CmsError> =>
  results[0]?.meta?.changes === 1 ? Effect.void : Effect.fail(concurrentModification(operation));

const toPhoto = (row: PhotoRow): Effect.Effect<CrmPhoto, CmsError> =>
  Schema.decodeEffect(CrmPhotoSchema)({
    id: row.id,
    originalName: row.originalName,
    mime: row.mime,
    byteSize: row.byteSize,
    sha256: row.sha256,
    filePath: `/crm/assets/${row.assetId}/photos/${row.id}/file`,
    createdAt: row.createdAt,
  }).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message: "Invalid CRM photo data",
          status: HttpStatus.InternalServerError,
          operation: "load_asset",
          cause,
        }),
    ),
  );

const toLocation = (row: LocationRow): Effect.Effect<CrmLocation, CmsError> =>
  Schema.decodeEffect(CrmLocationSchema)({
    id: row.id,
    location: row.location,
    note: row.note,
    loggedBy: row.loggedBy,
    createdAt: row.createdAt,
  }).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message: "Invalid CRM location data",
          status: HttpStatus.InternalServerError,
          operation: "load_asset",
          cause,
        }),
    ),
  );

const toAsset = (
  row: AssetRow,
  photos: ReadonlyArray<CrmPhoto>,
  locations: ReadonlyArray<CrmLocation>,
): Effect.Effect<CrmAsset, CmsError> =>
  decode(
    CrmAssetSchema,
    {
      id: row.id,
      name: row.name,
      serialNumber: row.serialNumber,
      description: row.description,
      category: row.category,
      status: row.status,
      location: row.location,
      hash: row.hash,
      version: row.version,
      qrPath: `/crm/assets/${row.id}/qr.svg`,
      photos,
      locations,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
    "load_asset",
  );

export const assetExists = Effect.fn("CrmService.assetExists")(function* (
  db: CmsD1Binding,
  id: string,
  operation = "asset_exists",
) {
  yield* requireAssetRow(db, id, operation);
});

export const getAsset = Effect.fn("CrmService.getAsset")(function* (
  db: CmsD1Binding,
  id: string,
  operation = "get_asset",
) {
  const row = yield* requireAssetRow(db, id, operation);
  const photoValues = yield* queryAll(
    db,
    `SELECT ${PHOTO_COLUMNS} FROM crm_asset_photos WHERE asset_id = ? ORDER BY created_at ASC`,
    [id],
    operation,
  );
  const locationValues = yield* queryAll(
    db,
    `SELECT ${LOCATION_COLUMNS} FROM crm_asset_locations WHERE asset_id = ? ORDER BY created_at DESC`,
    [id],
    operation,
  );
  const photos = yield* decode(Schema.Array(PhotoRowSchema), photoValues, operation);
  const locations = yield* decode(Schema.Array(LocationRowSchema), locationValues, operation);
  const decodedPhotos = yield* Effect.forEach(photos, toPhoto, { concurrency: 1 });
  const decodedLocations = yield* Effect.forEach(locations, toLocation, { concurrency: 1 });
  return yield* toAsset(row, decodedPhotos, decodedLocations);
});

const hashAsset = (
  input: CrmAssetInput,
  photoHashes: ReadonlyArray<string>,
  operation: string,
): Effect.Effect<string, CmsError> =>
  Effect.tryPromise({
    try: async () => {
      const canonical = JSON.stringify({
        name: input.name,
        serialNumber: input.serialNumber ?? "",
        description: input.description ?? "",
        category: input.category,
        status: input.status,
        location: input.location ?? "",
        photoHashes: [...photoHashes].sort(),
      });
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
        "",
      );
    },
    catch: (cause) =>
      new CmsError({
        message: "Asset hash failed",
        status: HttpStatus.InternalServerError,
        operation,
        cause,
      }),
  });

export const sha256Digest = (
  bytes: ArrayBuffer,
  operation: string,
): Effect.Effect<{ readonly digest: ArrayBuffer; readonly sha256: string }, CmsError> =>
  Effect.tryPromise({
    try: async () => {
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return {
        digest,
        sha256: Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join(""),
      };
    },
    catch: (cause) =>
      new CmsError({
        message: "Photo hash failed",
        status: HttpStatus.InternalServerError,
        operation,
        cause,
      }),
  });

const inputForHash = (asset: CrmAsset, location: string | null): CrmAssetInput => ({
  name: asset.name,
  serialNumber: asset.serialNumber,
  description: asset.description,
  category: asset.category,
  status: asset.status,
  location,
});

const assetUpdateStatement = (
  db: CmsD1Binding,
  id: string,
  input: CrmAssetInput,
  hash: string,
  updatedAt: string,
  version: number,
  mutationId: string,
) =>
  db
    .prepare(
      "UPDATE crm_assets SET name = ?, serial_number = ?, description = ?, category = ?, status = ?, location = ?, hash = ?, version = version + 1, mutation_id = ?, updated_at = ? WHERE id = ? AND version = ?",
    )
    .bind(
      input.name,
      input.serialNumber,
      input.description,
      input.category,
      input.status,
      input.location,
      hash,
      mutationId,
      updatedAt,
      id,
      version,
    );

export const createAsset = Effect.fn("CrmService.createAsset")(function* (
  db: CmsD1Binding,
  r2: CmsR2Binding,
  input: CrmAssetInput,
  photos: ReadonlyArray<CrmPhotoUpload>,
  actor: string,
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const hash = yield* hashAsset(
    input,
    photos.map((photo) => photo.sha256),
    "create_asset",
  );
  const photoRecords = photos.map((photo) => ({ photo, photoId: crypto.randomUUID() }));

  const persist = Effect.gen(function* () {
    yield* Effect.forEach(
      photoRecords,
      ({ photo, photoId }) =>
        Effect.tryPromise({
          try: () =>
            r2.put(photoObjectKey(id, photoId, photo.name), photo.bytes, {
              httpMetadata: { contentType: photo.mime },
              sha256: photo.digest,
            }),
          catch: (cause) =>
            new CmsError({
              message: "Photo upload failed",
              status: HttpStatus.InternalServerError,
              operation: "create_asset",
              cause,
            }),
        }).pipe(Effect.asVoid),
      { concurrency: 1 },
    );

    yield* runStatement(
      db,
      "INSERT INTO crm_assets (id, name, serial_number, description, category, status, location, hash, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        input.name,
        input.serialNumber,
        input.description,
        input.category,
        input.status,
        input.location,
        hash,
        actor,
        now,
        now,
      ],
      "create_asset",
    );

    yield* Effect.forEach(
      photoRecords,
      ({ photo, photoId }) =>
        runStatement(
          db,
          "INSERT INTO crm_asset_photos (id, asset_id, object_key, original_name, mime, byte_size, sha256, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            photoId,
            id,
            photoObjectKey(id, photoId, photo.name),
            photo.name,
            photo.mime,
            photo.bytes.byteLength,
            photo.sha256,
            now,
          ],
          "create_asset",
        ),
      { concurrency: 1 },
    );

    if (input.location !== null) {
      yield* runStatement(
        db,
        "INSERT INTO crm_asset_locations (id, asset_id, location, note, logged_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [crypto.randomUUID(), id, input.location, null, actor, now],
        "create_asset",
      );
    }
  });

  yield* persist.pipe(
    Effect.onError(() =>
      Effect.all(
        [
          cleanupR2Objects(
            r2,
            photoRecords.map(({ photo, photoId }) => photoObjectKey(id, photoId, photo.name)),
          ),
          Effect.ignore(
            runStatement(db, "DELETE FROM crm_assets WHERE id = ?", [id], "create_asset"),
          ),
        ],
        { concurrency: 1 },
      ),
    ),
  );

  return yield* getAsset(db, id, "create_asset");
});

const AssetCountRowSchema = Schema.Struct({ total: Schema.Finite });

const normalizePaging = (paging: CrmPaging) => ({
  page: Math.max(paging.page ?? 1, 1),
  limit: Math.min(Math.max(paging.pageSize ?? 100, 1), 100),
});

export const listAssets = Effect.fn("CrmService.listAssets")(function* (
  db: CmsD1Binding,
  paging: CrmPaging = {},
) {
  const { page, limit } = normalizePaging(paging);
  const countValue = yield* queryFirst(
    db,
    "SELECT COUNT(*) AS total FROM crm_assets",
    [],
    "list_assets",
  );
  const count =
    countValue === null
      ? { total: 0 }
      : yield* decode(AssetCountRowSchema, countValue, "list_assets");
  const totalPages = Math.max(1, Math.ceil(count.total / limit));
  const rows = yield* queryAll(
    db,
    `SELECT ${ASSET_COLUMNS} FROM crm_assets ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?`,
    [limit, (page - 1) * limit],
    "list_assets",
  );
  const assetRows = yield* Effect.forEach(
    rows,
    (row) => decode(AssetRowSchema, row, "list_assets"),
    { concurrency: 1 },
  );
  if (assetRows.length === 0) {
    return {
      docs: [],
      totalDocs: count.total,
      limit,
      page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    } satisfies CrmAssetListResponse;
  }

  const placeholders = assetRows.map(() => "?").join(", ");
  const [photoValues, locationValues] = yield* Effect.all(
    [
      queryAll(
        db,
        `SELECT ${PHOTO_COLUMNS} FROM crm_asset_photos WHERE asset_id IN (${placeholders}) ORDER BY created_at ASC`,
        assetRows.map((asset) => asset.id),
        "list_assets",
      ),
      queryAll(
        db,
        `SELECT ${LOCATION_COLUMNS} FROM crm_asset_locations WHERE asset_id IN (${placeholders}) ORDER BY created_at DESC`,
        assetRows.map((asset) => asset.id),
        "list_assets",
      ),
    ],
    { concurrency: 1 },
  );
  const photos = yield* decode(Schema.Array(PhotoRowSchema), photoValues, "list_assets");
  const locations = yield* decode(Schema.Array(LocationRowSchema), locationValues, "list_assets");
  const photosByAsset = new Map<string, Array<CrmPhoto>>();
  const locationsByAsset = new Map<string, Array<CrmLocation>>();
  yield* Effect.forEach(
    photos,
    (photo) =>
      Effect.gen(function* () {
        const decoded = yield* toPhoto(photo);
        const existing = photosByAsset.get(photo.assetId);
        if (existing === undefined) {
          photosByAsset.set(photo.assetId, [decoded]);
        } else {
          existing.push(decoded);
        }
        return decoded;
      }),
    { concurrency: 1 },
  );
  yield* Effect.forEach(
    locations,
    (locationRow) =>
      Effect.gen(function* () {
        const decoded = yield* toLocation(locationRow);
        const existing = locationsByAsset.get(locationRow.assetId);
        if (existing === undefined) {
          locationsByAsset.set(locationRow.assetId, [decoded]);
        } else {
          existing.push(decoded);
        }
        return decoded;
      }),
    { concurrency: 1 },
  );
  const assets = yield* Effect.forEach(
    assetRows,
    (asset) =>
      toAsset(asset, photosByAsset.get(asset.id) ?? [], locationsByAsset.get(asset.id) ?? []),
    { concurrency: 1 },
  );
  return {
    docs: assets,
    totalDocs: count.total,
    limit,
    page,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  } satisfies CrmAssetListResponse;
});

export const updateAsset = Effect.fn("CrmService.updateAsset")(function* (
  db: CmsD1Binding,
  id: string,
  input: CrmAssetInput,
  expectedVersion: number,
  actor: string,
) {
  const initialRow = yield* requireAssetRow(db, id, "update_asset");
  const current = yield* getAsset(db, id, "update_asset");
  const currentRow = yield* requireAssetRow(db, id, "update_asset");
  if (initialRow.version !== currentRow.version || currentRow.version !== expectedVersion)
    return yield* concurrentModification("update_asset");
  const updatedAt = new Date().toISOString();
  const hash = yield* hashAsset(
    input,
    current.photos.map((photo) => photo.sha256),
    "update_asset",
  );
  const mutationId = crypto.randomUUID();
  const statements = [
    assetUpdateStatement(db, id, input, hash, updatedAt, expectedVersion, mutationId),
  ];
  if (current.location !== input.location && input.location !== null) {
    statements.push(
      db
        .prepare(
          "INSERT INTO crm_asset_locations (id, asset_id, location, note, logged_by, created_at) SELECT ?, id, ?, ?, ?, ? FROM crm_assets WHERE id = ? AND version = ? AND hash = ? AND mutation_id = ? AND updated_at = ?",
        )
        .bind(
          crypto.randomUUID(),
          input.location,
          null,
          actor,
          updatedAt,
          id,
          expectedVersion + 1,
          hash,
          mutationId,
          updatedAt,
        ),
    );
  }
  const results = yield* runBatch(db, statements, "update_asset");
  yield* assertConditionalUpdate(results, "update_asset");
  return yield* getAsset(db, id, "update_asset");
});

export const logAssetLocation = Effect.fn("CrmService.logAssetLocation")(function* (
  db: CmsD1Binding,
  id: string,
  input: CrmLocationInput,
  expectedVersion: number,
  actor: string,
) {
  const initialRow = yield* requireAssetRow(db, id, "log_location");
  const current = yield* getAsset(db, id, "log_location");
  const currentRow = yield* requireAssetRow(db, id, "log_location");
  if (initialRow.version !== currentRow.version || currentRow.version !== expectedVersion)
    return yield* concurrentModification("log_location");
  const updatedAt = new Date().toISOString();
  const next = inputForHash(current, input.location);
  const hash = yield* hashAsset(
    next,
    current.photos.map((photo) => photo.sha256),
    "log_location",
  );
  const mutationId = crypto.randomUUID();
  const results = yield* runBatch(
    db,
    [
      assetUpdateStatement(db, id, next, hash, updatedAt, expectedVersion, mutationId),
      db
        .prepare(
          "INSERT INTO crm_asset_locations (id, asset_id, location, note, logged_by, created_at) SELECT ?, id, ?, ?, ?, ? FROM crm_assets WHERE id = ? AND version = ? AND hash = ? AND mutation_id = ? AND updated_at = ?",
        )
        .bind(
          crypto.randomUUID(),
          input.location,
          input.note,
          actor,
          updatedAt,
          id,
          expectedVersion + 1,
          hash,
          mutationId,
          updatedAt,
        ),
    ],
    "log_location",
  );
  yield* assertConditionalUpdate(results, "log_location");
  return yield* getAsset(db, id, "log_location");
});

export const addAssetPhotos = Effect.fn("CrmService.addAssetPhotos")(function* (
  db: CmsD1Binding,
  r2: CmsR2Binding,
  id: string,
  photos: ReadonlyArray<CrmPhotoUpload>,
  expectedVersion: number,
  actor: string,
) {
  const initialRow = yield* requireAssetRow(db, id, "add_photos");
  const current = yield* getAsset(db, id, "add_photos");
  const currentRow = yield* requireAssetRow(db, id, "add_photos");
  if (initialRow.version !== currentRow.version || currentRow.version !== expectedVersion)
    return yield* concurrentModification("add_photos");
  const now = new Date().toISOString();
  const photoRecords = photos.map((photo) => ({ photo, photoId: crypto.randomUUID() }));
  const next = inputForHash(current, current.location);
  const hash = yield* hashAsset(
    next,
    [...current.photos.map((photo) => photo.sha256), ...photos.map((photo) => photo.sha256)],
    "add_photos",
  );
  const mutationId = crypto.randomUUID();
  const persist = Effect.gen(function* () {
    yield* Effect.forEach(
      photoRecords,
      ({ photo, photoId }) =>
        Effect.tryPromise({
          try: () =>
            r2.put(photoObjectKey(id, photoId, photo.name), photo.bytes, {
              httpMetadata: { contentType: photo.mime },
              sha256: photo.digest,
            }),
          catch: (cause) =>
            new CmsError({
              message: "Photo upload failed",
              status: HttpStatus.InternalServerError,
              operation: "add_photos",
              cause,
            }),
        }).pipe(Effect.asVoid),
      { concurrency: 1 },
    );
    const statements = [
      db
        .prepare(
          "UPDATE crm_assets SET hash = ?, version = version + 1, mutation_id = ?, updated_at = ? WHERE id = ? AND version = ?",
        )
        .bind(hash, mutationId, now, id, expectedVersion),
      ...photoRecords.map(({ photo, photoId }) =>
        db
          .prepare(
            "INSERT INTO crm_asset_photos (id, asset_id, object_key, original_name, mime, byte_size, sha256, created_at) SELECT ?, id, ?, ?, ?, ?, ?, ? FROM crm_assets WHERE id = ? AND version = ? AND mutation_id = ?",
          )
          .bind(
            photoId,
            photoObjectKey(id, photoId, photo.name),
            photo.name,
            photo.mime,
            photo.bytes.byteLength,
            photo.sha256,
            now,
            id,
            expectedVersion + 1,
            mutationId,
          ),
      ),
    ];
    const results = yield* runBatch(db, statements, "add_photos");
    yield* assertConditionalUpdate(results, "add_photos");
  });

  yield* persist.pipe(
    Effect.onError(() =>
      Effect.all(
        [
          cleanupR2Objects(
            r2,
            photoRecords.map(({ photo, photoId }) => photoObjectKey(id, photoId, photo.name)),
          ),
          Effect.forEach(
            photoRecords,
            ({ photoId }) =>
              Effect.ignore(
                runStatement(
                  db,
                  "DELETE FROM crm_asset_photos WHERE id = ?",
                  [photoId],
                  "add_photos",
                ),
              ),
            { concurrency: 1 },
          ),
        ],
        { concurrency: 1 },
      ),
    ),
  );
  yield* Effect.logInfo("CRM photos added", { assetId: id, actor });
  return yield* getAsset(db, id, "add_photos");
});

export const getAssetPhoto = Effect.fn("CrmService.getAssetPhoto")(function* (
  db: CmsD1Binding,
  r2: CmsR2Binding,
  assetId: string,
  photoId: string,
) {
  yield* requireAssetRow(db, assetId, "get_photo");
  const value = yield* queryFirst(
    db,
    `SELECT ${PHOTO_COLUMNS} FROM crm_asset_photos WHERE id = ? AND asset_id = ?`,
    [photoId, assetId],
    "get_photo",
  );
  if (value === null) {
    return yield* new CmsError({
      message: "Photo not found",
      status: HttpStatus.NotFound,
      operation: "get_photo",
    });
  }
  const photo = yield* decode(PhotoRowSchema, value, "get_photo");
  const object = yield* Effect.tryPromise({
    try: () => r2.get(photo.objectKey),
    catch: (cause) =>
      new CmsError({
        message: "Photo read failed",
        status: HttpStatus.InternalServerError,
        operation: "get_photo",
        cause,
      }),
  });
  if (object === null) {
    return yield* new CmsError({
      message: "Photo not found",
      status: HttpStatus.NotFound,
      operation: "get_photo",
    });
  }
  return { mime: photo.mime, originalName: photo.originalName, object };
});
const decodeInput = <A, I, B>(
  schema: Schema.Codec<A, I>,
  value: B,
  operation: string,
): Effect.Effect<A, CmsError> =>
  Schema.decodeUnknownEffect(schema)(value).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message: "Invalid CRM input",
          status: HttpStatus.BadRequest,
          operation,
          cause,
        }),
    ),
  );

const normalizedInputError = (operation: string): CmsError =>
  new CmsError({
    message: "Invalid CRM input",
    status: HttpStatus.BadRequest,
    operation,
  });

const normalizeAssetInput = (
  input: CrmAssetInput,
  operation: string,
): Effect.Effect<CrmAssetInput, CmsError> => {
  const normalized: CrmAssetInput = {
    name: input.name.trim(),
    serialNumber: input.serialNumber?.trim() || null,
    description: input.description?.trim() || null,
    category: input.category.trim() || "General",
    status: input.status,
    location: input.location?.trim() || null,
  };
  return normalized.name.length === 0 || normalized.name.length > 120
    ? Effect.fail(normalizedInputError(operation))
    : Effect.succeed(normalized);
};

const normalizeLocationInput = (
  input: CrmLocationInput,
  operation: string,
): Effect.Effect<CrmLocationInput, CmsError> => {
  const normalized: CrmLocationInput = {
    location: input.location.trim(),
    note: input.note?.trim() || null,
  };
  return normalized.location.length === 0 || normalized.location.length > 500
    ? Effect.fail(normalizedInputError(operation))
    : Effect.succeed(normalized);
};

export const decodeCrmAssetInput = <I>(
  value: I,
  operation: string,
): Effect.Effect<CrmAssetInput, CmsError> =>
  decodeInput(CrmAssetInputSchema, value, operation).pipe(
    Effect.flatMap((input) => normalizeAssetInput(input, operation)),
  );

export const decodeCrmAssetUpdate = <I>(
  value: I,
  operation: string,
): Effect.Effect<CrmAssetUpdate, CmsError> =>
  decodeInput(CrmAssetUpdateSchema, value, operation).pipe(
    Effect.flatMap((input) =>
      normalizeAssetInput(input, operation).pipe(
        Effect.map((normalized) => ({ ...normalized, version: input.version })),
      ),
    ),
  );

export const decodeCrmLocationInput = <I>(
  value: I,
  operation: string,
): Effect.Effect<CrmLocationInput, CmsError> =>
  decodeInput(CrmLocationInputSchema, value, operation).pipe(
    Effect.flatMap((input) => normalizeLocationInput(input, operation)),
  );

export const decodeCrmLocationUpdate = <I>(
  value: I,
  operation: string,
): Effect.Effect<CrmLocationUpdate, CmsError> =>
  decodeInput(CrmLocationUpdateSchema, value, operation).pipe(
    Effect.flatMap((input) =>
      normalizeLocationInput(input, operation).pipe(
        Effect.map((normalized) => ({ ...normalized, version: input.version })),
      ),
    ),
  );

export const decodeCrmVersion = (
  value: string,
  operation: string,
): Effect.Effect<number, CmsError> =>
  decodeInput(CrmAssetVersionInputSchema, value, operation).pipe(Effect.map((version) => version));

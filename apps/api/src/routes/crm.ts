import { Elysia } from "elysia";
import { Effect, Option, Schema } from "effect";
import { renderSVG } from "uqr";
import {
  CrmAssetId,
  CrmAssetInputSchema,
  CrmPagingSchema,
  CrmPhotoId,
  type CrmAssetInput,
} from "@tom/schemas/crm";
import { CmsError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import {
  parseAdminEmails,
  readCloudflareEnv,
  type CmsD1Binding,
  type CmsR2Binding,
} from "@tom/utils/services/config";
import { getRequestEnv, logContextFromRequest, runEffect } from "@tom/utils/services/worker";
import { createAuthFromEnv, isAdminEmail, requireSession } from "../services/auth";
import {
  addAssetPhotos,
  assetExists,
  createAsset,
  decodeCrmAssetUpdate,
  decodeCrmLocationUpdate,
  decodeCrmVersion,
  getAsset,
  getAssetPhoto,
  listAssets,
  logAssetLocation,
  sha256Digest,
  updateAsset,
  type CrmPhotoUpload,
} from "../services/crm";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_PHOTOS = 6;
const MAX_REQUEST_BYTES = 50 * 1024 * 1024;
const PHOTO_MIMES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const AssetParamsSchema = Schema.Struct({ id: CrmAssetId });
const PhotoParamsSchema = Schema.Struct({ id: CrmAssetId, photoId: CrmPhotoId });

const assetParamsSchema = Schema.toStandardSchemaV1(AssetParamsSchema);
const photoParamsSchema = Schema.toStandardSchemaV1(PhotoParamsSchema);

type CrmAuthorContext = {
  readonly db: CmsD1Binding;
  readonly r2: CmsR2Binding;
  readonly actor: string;
  readonly crmUrl: string | undefined;
};

const failInput = (message: string, operation: string): Effect.Effect<never, CmsError> =>
  Effect.fail(new CmsError({ message, status: HttpStatus.BadRequest, operation }));

type ResolvedCrmEnv = Awaited<ReturnType<typeof readCloudflareEnv>>;

const readCrmConfig = (request: Request): Effect.Effect<ResolvedCrmEnv, CmsError> =>
  Effect.tryPromise({
    try: () => readCloudflareEnv(getRequestEnv(request)),
    catch: (cause) =>
      new CmsError({
        message: "Failed to load CRM configuration",
        status: HttpStatus.InternalServerError,
        operation: "crm_auth",
        cause,
      }),
  });

const requireCrmStorage = (
  env: ResolvedCrmEnv,
): Effect.Effect<{ readonly db: CmsD1Binding; readonly r2: CmsR2Binding }, CmsError> =>
  Effect.gen(function* () {
    const db = env.CRM_D1;
    const r2 = env.CRM_MEDIA;
    if (!db || !r2) {
      return yield* new CmsError({
        message: "CRM storage not configured",
        status: HttpStatus.InternalServerError,
        operation: "crm_auth",
      });
    }
    return { db, r2 };
  });

const requireCrmActor = (env: ResolvedCrmEnv, request: Request): Effect.Effect<string, CmsError> =>
  Effect.gen(function* () {
    const auth = yield* createAuthFromEnv(env);
    const author = yield* requireSession(auth, request.headers);
    const email = Option.filter(Option.fromNullishOr(author.user.email), Schema.is(Schema.String));
    if (
      Option.isNone(email) ||
      !isAdminEmail(email.value, parseAdminEmails(env.CMS_ADMIN_EMAILS))
    ) {
      return yield* new CmsError({
        message: "Forbidden",
        status: HttpStatus.Forbidden,
        operation: "crm_auth",
      });
    }
    return email.value;
  });

const requireCrmAuthor = (request: Request): Effect.Effect<CrmAuthorContext, CmsError> =>
  Effect.gen(function* () {
    const env = yield* readCrmConfig(request);
    const storage = yield* requireCrmStorage(env);
    const actor = yield* requireCrmActor(env, request);
    return { ...storage, actor, crmUrl: env.CRM_URL };
  });

const withAuthor = <A>(
  request: Request,
  use: (context: CrmAuthorContext) => Effect.Effect<A, CmsError>,
): Effect.Effect<A, CmsError> =>
  Effect.gen(function* () {
    const context = yield* requireCrmAuthor(request);
    return yield* use(context);
  });

const runCrm = <A>(request: Request, effect: Effect.Effect<A, CmsError>): Promise<A> =>
  runEffect(effect, logContextFromRequest(request, "tom-api"));

const decodeJson = <A, I, B>(
  schema: Schema.Codec<A, I>,
  value: B,
  message: string,
  operation: string,
): Effect.Effect<A, CmsError> =>
  Schema.decodeUnknownEffect(schema)(value).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message,
          status: HttpStatus.BadRequest,
          operation,
          cause,
        }),
    ),
  );

const sanitizeFileName = (name: string): string => {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  return cleaned.length > 0 ? cleaned : "photo";
};

const asciiAt = (bytes: Uint8Array, offset: number, length: number): string =>
  String.fromCharCode(...bytes.slice(offset, offset + length));

const isJpeg = (bytes: Uint8Array): boolean =>
  bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

const isPng = (bytes: Uint8Array): boolean =>
  bytes.length >= 8 &&
  bytes[0] === 0x89 &&
  bytes[1] === 0x50 &&
  bytes[2] === 0x4e &&
  bytes[3] === 0x47 &&
  bytes[4] === 0x0d &&
  bytes[5] === 0x0a &&
  bytes[6] === 0x1a &&
  bytes[7] === 0x0a;

const isWebp = (bytes: Uint8Array): boolean =>
  bytes.length >= 12 && asciiAt(bytes, 0, 4) === "RIFF" && asciiAt(bytes, 8, 4) === "WEBP";

const isGif = (bytes: Uint8Array): boolean =>
  bytes.length >= 6 && (asciiAt(bytes, 0, 6) === "GIF87a" || asciiAt(bytes, 0, 6) === "GIF89a");

const isAvif = (bytes: Uint8Array): boolean => {
  if (bytes.length < 12 || asciiAt(bytes, 4, 4) !== "ftyp") return false;
  const brand = asciiAt(bytes, 8, 4);
  return brand === "avif" || brand === "avis";
};

const detectImageMime = (bytes: Uint8Array): string | null => {
  if (isJpeg(bytes)) return "image/jpeg";
  if (isPng(bytes)) return "image/png";
  if (isWebp(bytes)) return "image/webp";
  if (isGif(bytes)) return "image/gif";
  if (isAvif(bytes)) return "image/avif";
  return null;
};

const parseForm = (request: Request, operation: string): Effect.Effect<FormData, CmsError> =>
  Effect.gen(function* () {
    const length = request.headers.get("content-length");
    if (length !== null && Number(length) > MAX_REQUEST_BYTES) {
      return yield* new CmsError({
        message: "Upload request too large",
        status: HttpStatus.PayloadTooLarge,
        operation,
      });
    }
    return yield* Effect.tryPromise({
      try: () => request.formData(),
      catch: (cause) =>
        new CmsError({
          message: "Unreadable CRM form",
          status: HttpStatus.BadRequest,
          operation,
          cause,
        }),
    });
  });

const formText = (form: FormData, name: string): string => {
  const value = form.get(name);
  return value instanceof globalThis.File ? "" : (value?.toString() ?? "");
};

const nullableText = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseAssetInput = (form: FormData): Effect.Effect<CrmAssetInput, CmsError> =>
  decodeJson(
    CrmAssetInputSchema,
    {
      name: formText(form, "name").trim(),
      serialNumber: nullableText(formText(form, "serialNumber")),
      description: nullableText(formText(form, "description")),
      category: nullableText(formText(form, "category")) ?? "General",
      status: formText(form, "status") || "available",
      location: nullableText(formText(form, "location")),
    },
    "Invalid asset metadata",
    "create_asset",
  );

const parsePhotos = (
  request: Request,
  form: FormData,
  operation: string,
): Effect.Effect<ReadonlyArray<CrmPhotoUpload>, CmsError> =>
  Effect.gen(function* () {
    const files = form
      .getAll("photos")
      .filter((value): value is globalThis.File => value instanceof globalThis.File);
    if (files.length > MAX_PHOTOS) return yield* failInput("Too many photos", operation);
    if (request.headers.get("content-length") !== null) {
      const contentLength = Number(request.headers.get("content-length"));
      if (contentLength > MAX_REQUEST_BYTES) {
        return yield* new CmsError({
          message: "Upload request too large",
          status: HttpStatus.PayloadTooLarge,
          operation,
        });
      }
    }
    return yield* Effect.forEach(
      files,
      (file) =>
        Effect.gen(function* () {
          if (file.size === 0) return yield* failInput("Photo is empty", operation);
          if (file.size > MAX_PHOTO_BYTES) {
            return yield* new CmsError({
              message: "Photo is too large",
              status: HttpStatus.PayloadTooLarge,
              operation,
            });
          }
          if (!PHOTO_MIMES.has(file.type)) {
            return yield* failInput(`Unsupported photo type: ${file.type}`, operation);
          }
          const bytes = yield* Effect.tryPromise({
            try: () => file.arrayBuffer(),
            catch: (cause) =>
              new CmsError({
                message: "Unreadable photo",
                status: HttpStatus.BadRequest,
                operation,
                cause,
              }),
          });
          if (detectImageMime(new Uint8Array(bytes)) !== file.type) {
            return yield* failInput(`Photo bytes do not match type: ${file.type}`, operation);
          }
          const digest = yield* sha256Digest(bytes, operation);
          return {
            name: sanitizeFileName(file.name),
            mime: file.type,
            bytes,
            digest: digest.digest,
            sha256: digest.sha256,
          } satisfies CrmPhotoUpload;
        }),
      { concurrency: 1 },
    );
  });

const responseHeaders = (
  mime: string,
  fileName?: string,
  disposition: "inline" | "attachment" = "inline",
): Headers => {
  const headers = new Headers({
    "Content-Type": mime,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox",
  });
  if (fileName !== undefined) {
    headers.set("Content-Disposition", `${disposition}; filename="${fileName}"`);
  }
  return headers;
};

export const crmRoutes = new Elysia({ name: "crm" })
  .get(
    "/assets",
    ({ request }) =>
      runCrm(
        request,
        withAuthor(request, ({ db }) =>
          Effect.gen(function* () {
            const paging = yield* decodeJson(
              CrmPagingSchema,
              Object.fromEntries(new URL(request.url).searchParams.entries()),
              "Invalid CRM paging",
              "list_assets",
            );
            return yield* listAssets(db, paging);
          }),
        ),
      ),
    { detail: { description: "List CRM assets", tags: ["crm"] } },
  )
  .post(
    "/assets",
    ({ request }) =>
      runCrm(
        request,
        withAuthor(request, ({ db, r2, actor }) =>
          Effect.gen(function* () {
            const form = yield* parseForm(request, "create_asset");
            const input = yield* parseAssetInput(form);
            const photos = yield* parsePhotos(request, form, "create_asset");
            return yield* createAsset(db, r2, input, photos, actor);
          }),
        ),
      ),
    { detail: { description: "Create a CRM asset with photos", tags: ["crm"] } },
  )
  .get(
    "/assets/:id/qr.svg",
    ({ params, request }) =>
      runCrm(
        request,
        withAuthor(request, ({ db, crmUrl }) =>
          Effect.gen(function* () {
            const { id } = yield* decodeJson(
              AssetParamsSchema,
              params,
              "Invalid asset id",
              "get_qr",
            );
            yield* assetExists(db, id, "get_qr");
            const base = crmUrl ?? new URL(request.url).origin;
            const link = new URL(`/?asset=${encodeURIComponent(id)}`, base).toString();
            const disposition =
              new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";
            return new Response(renderSVG(link, { ecc: "M", border: 4 }), {
              headers: responseHeaders("image/svg+xml", `mono-${id}.svg`, disposition),
            });
          }),
        ),
      ),
    {
      params: assetParamsSchema,
      detail: { description: "Render an asset QR code", tags: ["crm"] },
    },
  )
  .get(
    "/assets/:id/photos/:photoId/file",
    ({ params, request }) =>
      runCrm(
        request,
        withAuthor(request, ({ db, r2 }) =>
          Effect.gen(function* () {
            const { id, photoId } = yield* decodeJson(
              PhotoParamsSchema,
              params,
              "Invalid photo id",
              "get_photo_file",
            );
            const result = yield* getAssetPhoto(db, r2, id, photoId);
            const bytes = yield* Effect.tryPromise({
              try: () => result.object.arrayBuffer(),
              catch: (cause) =>
                new CmsError({
                  message: "Photo read failed",
                  status: HttpStatus.InternalServerError,
                  operation: "get_photo_file",
                  cause,
                }),
            });
            return new Response(bytes, {
              headers: responseHeaders(result.mime, result.originalName),
            });
          }),
        ),
      ),
    { params: photoParamsSchema, detail: { description: "Read a CRM asset photo", tags: ["crm"] } },
  )
  .get(
    "/assets/:id",
    ({ params, request }) =>
      runCrm(
        request,
        withAuthor(request, ({ db }) =>
          Effect.gen(function* () {
            const { id } = yield* decodeJson(
              AssetParamsSchema,
              params,
              "Invalid asset id",
              "get_asset",
            );
            return yield* getAsset(db, id, "get_asset");
          }),
        ),
      ),
    { params: assetParamsSchema, detail: { description: "Get a CRM asset", tags: ["crm"] } },
  )
  .put(
    "/assets/:id",
    ({ body, params, request }) =>
      runCrm(
        request,
        withAuthor(request, ({ db, actor }) =>
          Effect.gen(function* () {
            const { id } = yield* decodeJson(
              AssetParamsSchema,
              params,
              "Invalid asset id",
              "update_asset",
            );
            const input = yield* decodeCrmAssetUpdate(body, "update_asset");
            return yield* updateAsset(db, id, input, input.version, actor);
          }),
        ),
      ),
    {
      params: assetParamsSchema,
      detail: { description: "Update CRM asset metadata", tags: ["crm"] },
    },
  )
  .post(
    "/assets/:id/photos",
    ({ params, request }) =>
      runCrm(
        request,
        withAuthor(request, ({ db, r2, actor }) =>
          Effect.gen(function* () {
            const { id } = yield* decodeJson(
              AssetParamsSchema,
              params,
              "Invalid asset id",
              "add_photos",
            );
            const form = yield* parseForm(request, "add_photos");
            const photos = yield* parsePhotos(request, form, "add_photos");
            if (photos.length === 0) {
              return yield* failInput("At least one photo is required", "add_photos");
            }
            const version = yield* decodeCrmVersion(formText(form, "version"), "add_photos");
            return yield* addAssetPhotos(db, r2, id, photos, version, actor);
          }),
        ),
      ),
    {
      params: assetParamsSchema,
      detail: { description: "Add photos to a CRM asset", tags: ["crm"] },
    },
  )
  .post(
    "/assets/:id/locations",
    ({ body, params, request }) =>
      runCrm(
        request,
        withAuthor(request, ({ db, actor }) =>
          Effect.gen(function* () {
            const { id } = yield* decodeJson(
              AssetParamsSchema,
              params,
              "Invalid asset id",
              "log_location",
            );
            const input = yield* decodeCrmLocationUpdate(body, "log_location");
            return yield* logAssetLocation(db, id, input, input.version, actor);
          }),
        ),
      ),
    {
      params: assetParamsSchema,
      detail: { description: "Log a CRM asset location", tags: ["crm"] },
    },
  );

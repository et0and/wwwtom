import { Effect, Schema } from "effect";
import { HttpError } from "@tom/types/errors";
import type { AddressDbService } from "./db";
import { SQL } from "./queries";

const LINZ_LAYER = "data.linz.govt.nz:layer-105689";
const WFS_VERSION = "2.0.0";
const PAGE_SIZE = 1000;
const MAX_PAGES_PER_INGEST = 900;

const buildBaseUrl = (apiKey: string): string =>
  `https://data.linz.govt.nz/services;key=${apiKey}/wfs/`;

const getCapabilitiesUrl = (apiKey: string): string =>
  `${buildBaseUrl(apiKey)}?service=WFS&request=GetCapabilities`;

const getHitsUrl = (apiKey: string): string =>
  `${buildBaseUrl(
    apiKey,
  )}?service=WFS&version=${WFS_VERSION}&request=GetFeature&typeNames=${encodeURIComponent(
    LINZ_LAYER,
  )}&resultType=hits`;

const getPageUrl = (apiKey: string, startIndex: number, count: number): string =>
  `${buildBaseUrl(
    apiKey,
  )}?service=WFS&version=${WFS_VERSION}&request=GetFeature&typeNames=${encodeURIComponent(
    LINZ_LAYER,
  )}&count=${count}&startIndex=${startIndex}&outputFormat=application/json&srsName=EPSG:4326`;

const parseUpdateSequence = (xml: string): string | null => {
  const match = xml.match(/updateSequence="([^"]+)"/);
  return match?.[1] ?? null;
};

const parseNumberMatched = (xml: string): number | null => {
  const match = xml.match(/numberMatched="(\d+)"/);
  return match ? Number(match[1]) : null;
};

const fetchXml = (url: string, operation: string): Effect.Effect<string, HttpError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${operation} failed: ${response.status}`);
      }
      return response.text();
    },
    catch: (cause) =>
      new HttpError({ message: `LINZ ${operation} failed: ${String(cause)}`, status: 500 }),
  });

const nullishText = Schema.optional(Schema.NullOr(Schema.String));
const nullishNumber = Schema.optional(Schema.NullOr(Schema.NumberFromString));

const LinzPropertiesSchema = Schema.Struct({
  address_id: Schema.optional(Schema.NumberFromString),
  source_dataset: nullishText,
  change_id: nullishNumber,
  full_address_number: nullishText,
  full_address: nullishText,
  full_address_ascii: nullishText,
  full_road_name: nullishText,
  full_road_name_ascii: nullishText,
  road_name: nullishText,
  road_name_ascii: nullishText,
  road_type_name: nullishText,
  road_type_name_ascii: nullishText,
  suburb_locality: nullishText,
  suburb_locality_ascii: nullishText,
  town_city: nullishText,
  town_city_ascii: nullishText,
  territorial_authority: nullishText,
  unit_type: nullishText,
  unit_type_ascii: nullishText,
  unit_value: nullishText,
  level_type: nullishText,
  level_type_ascii: nullishText,
  level_value: nullishText,
  address_number_prefix: nullishText,
  address_number: nullishNumber,
  address_number_suffix: nullishText,
  address_number_high: nullishNumber,
  road_name_prefix: nullishText,
  road_suffix: nullishText,
  water_name: nullishText,
  water_name_ascii: nullishText,
  water_body_name: nullishText,
  water_body_name_ascii: nullishText,
  address_class: nullishText,
  address_class_ascii: nullishText,
  address_lifecycle: nullishText,
  gd2000_xcoord: nullishNumber,
  gd2000_ycoord: nullishNumber,
});

const LinzFeatureSchema = Schema.Struct({
  geometry: Schema.optional(
    Schema.Struct({
      coordinates: Schema.optional(Schema.Tuple([Schema.Number, Schema.Number])),
    }),
  ),
  properties: LinzPropertiesSchema,
});

const LinzFeatureCollectionSchema = Schema.Struct({
  features: Schema.optional(Schema.Array(LinzFeatureSchema)),
});

type LinzFeature = Schema.Schema.Type<typeof LinzFeatureSchema>;
type LinzFeatureCollection = Schema.Schema.Type<typeof LinzFeatureCollectionSchema>;

const fetchPage = (
  apiKey: string,
  startIndex: number,
  count: number,
): Effect.Effect<LinzFeatureCollection, HttpError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(getPageUrl(apiKey, startIndex, count));
      if (!response.ok) {
        throw new Error(`WFS fetch failed: ${response.status}`);
      }
      const raw = (await response.json()) as unknown;
      return Schema.decodeUnknownSync(LinzFeatureCollectionSchema)(raw);
    },
    catch: (cause) =>
      new HttpError({
        message: `Failed to fetch LINZ page ${startIndex}: ${String(cause)}`,
        status: 500,
      }),
  });

const INGEST_COLUMNS: readonly string[] = [
  "address_id",
  "source_dataset",
  "change_id",
  "full_address_number",
  "full_address",
  "full_address_ascii",
  "full_road_name",
  "full_road_name_ascii",
  "road_name",
  "road_name_ascii",
  "road_type_name",
  "road_type_name_ascii",
  "suburb_locality",
  "suburb_locality_ascii",
  "town_city",
  "town_city_ascii",
  "territorial_authority",
  "unit_type",
  "unit_type_ascii",
  "unit_value",
  "level_type",
  "level_type_ascii",
  "level_value",
  "address_number_prefix",
  "address_number",
  "address_number_suffix",
  "address_number_high",
  "road_name_prefix",
  "road_suffix",
  "water_name",
  "water_name_ascii",
  "water_body_name",
  "water_body_name_ascii",
  "address_class",
  "address_class_ascii",
  "address_lifecycle",
  "gd2000_xcoord",
  "gd2000_ycoord",
  "lat",
  "lng",
  "source_version",
];

const featureToValues = (
  feature: LinzFeature,
  version: string,
): (number | string | null)[] | null => {
  const props = feature.properties;
  const addressId = props.address_id;
  if (addressId === undefined) return null;

  const [lng, lat] = feature.geometry?.coordinates ?? [null, null];
  const get = <K extends keyof typeof props>(key: K): string | number | null =>
    (props[key] as string | number | null | undefined) ?? null;

  return [
    addressId,
    get("source_dataset"),
    get("change_id"),
    get("full_address_number"),
    get("full_address"),
    get("full_address_ascii"),
    get("full_road_name"),
    get("full_road_name_ascii"),
    get("road_name"),
    get("road_name_ascii"),
    get("road_type_name"),
    get("road_type_name_ascii"),
    get("suburb_locality"),
    get("suburb_locality_ascii"),
    get("town_city"),
    get("town_city_ascii"),
    get("territorial_authority"),
    get("unit_type"),
    get("unit_type_ascii"),
    get("unit_value"),
    get("level_type"),
    get("level_type_ascii"),
    get("level_value"),
    get("address_number_prefix"),
    get("address_number"),
    get("address_number_suffix"),
    get("address_number_high"),
    get("road_name_prefix"),
    get("road_suffix"),
    get("water_name"),
    get("water_name_ascii"),
    get("water_body_name"),
    get("water_body_name_ascii"),
    get("address_class"),
    get("address_class_ascii"),
    get("address_lifecycle"),
    get("gd2000_xcoord"),
    get("gd2000_ycoord"),
    lat ?? null,
    lng ?? null,
    version,
  ];
};

type UpsertQuery = {
  readonly text: string;
  readonly params: readonly (number | string | null)[];
};

const buildUpsertQuery = (values: readonly (readonly (number | string | null)[])[]) => {
  const columnList = INGEST_COLUMNS.join(", ");
  const updateList = INGEST_COLUMNS.filter((column) => column !== "address_id")
    .map((column) => `${column} = EXCLUDED.${column}`)
    .join(", ");

  const params: (number | string | null)[] = [];
  const rows = values.map((row) => {
    const placeholders = row.map((_, index) => `$${params.length + index + 1}`).join(", ");
    params.push(...row);
    return `(${placeholders})`;
  });

  return {
    text: `INSERT INTO addresses (${columnList}) VALUES ${rows.join(", ")} ON CONFLICT (address_id) DO UPDATE SET ${updateList}`,
    params,
  } satisfies UpsertQuery;
};

const upsertPage = (
  db: AddressDbService,
  values: readonly (readonly (number | string | null)[])[],
): Effect.Effect<void, HttpError> =>
  Effect.gen(function* () {
    if (values.length === 0) return;
    const sql = yield* db.primary;
    const query = buildUpsertQuery(values);
    yield* Effect.tryPromise({
      try: () => sql.unsafe<unknown>(query.text, query.params),
      catch: (cause) =>
        new HttpError({ message: `upsertPage failed: ${String(cause)}`, status: 500 }),
    });
  });

const cleanupOldVersions = (
  db: AddressDbService,
  version: string,
): Effect.Effect<void, HttpError> =>
  Effect.gen(function* () {
    const sql = yield* db.primary;
    for (;;) {
      const rows = yield* Effect.tryPromise({
        try: () => sql.unsafe<{ address_id: number }>(SQL.deleteOldAddresses, [version]),
        catch: (cause) =>
          new HttpError({ message: `cleanup failed: ${String(cause)}`, status: 500 }),
      });
      if (rows.length === 0) return;
      yield* Effect.logInfo("cleanupOldVersions batch", { version, deleted: rows.length });
    }
  });

export interface IngestStart {
  readonly status: "queued" | "noop" | "error";
  readonly version?: string;
  readonly runId?: string;
  readonly total?: number;
}

export const startIngestion = (
  linzApiKey: string | undefined,
  db: AddressDbService,
): Effect.Effect<IngestStart, HttpError> =>
  Effect.gen(function* () {
    if (!linzApiKey) {
      return yield* new HttpError({ message: "LINZ API key not configured", status: 500 });
    }

    yield* db.ensureSchema;

    const capabilities = yield* fetchXml(getCapabilitiesUrl(linzApiKey), "capabilities");
    const updateSequence = parseUpdateSequence(capabilities);
    if (!updateSequence) {
      return { status: "error" };
    }

    const currentVersion = yield* db.getDatasetVersion;
    if (currentVersion === updateSequence) {
      return { status: "noop", version: updateSequence };
    }

    const hits = yield* fetchXml(getHitsUrl(linzApiKey), "hits");
    const total = parseNumberMatched(hits);
    if (total === null || total === 0) {
      return { status: "error" };
    }

    const runId = crypto.randomUUID();
    yield* db.createIngestionRun(runId, updateSequence, total);

    return { status: "queued", version: updateSequence, runId, total };
  });

export const ingestRun = (
  linzApiKey: string | undefined,
  db: AddressDbService,
  runId: string,
  version: string,
  total: number,
): Effect.Effect<void, HttpError> =>
  Effect.gen(function* () {
    if (!linzApiKey) {
      return yield* new HttpError({ message: "LINZ API key not configured", status: 500 });
    }

    yield* db.ensureSchema;

    const pages = Math.ceil(total / PAGE_SIZE);
    const processedPages = Math.min(pages, MAX_PAGES_PER_INGEST);

    for (let page = 0; page < processedPages; page += 1) {
      const startIndex = page * PAGE_SIZE;
      const count = Math.min(PAGE_SIZE, total - startIndex);
      const collection = yield* fetchPage(linzApiKey, startIndex, count);

      const values = (collection.features ?? []).flatMap((feature) => {
        const row = featureToValues(feature, version);
        return row ? [row] : [];
      });

      if (values.length) {
        yield* upsertPage(db, values);
      }
      yield* db.updateIngestionRun(runId, values.length);
      yield* Effect.logInfo("ingestRun page", {
        runId,
        version,
        page: page + 1,
        pages: processedPages,
        count: values.length,
      });
    }

    if (processedPages < pages) {
      yield* Effect.logWarning("Ingestion truncated by worker budget", {
        runId,
        version,
        total,
        processedPages,
        pages,
      });
      return;
    }

    yield* db.finalizeIngestionRun(runId, "completed");
    yield* db.setDatasetVersion(version);
    yield* cleanupOldVersions(db, version);
    yield* db.rebuildSearchTerms;
    yield* Effect.logInfo("ingestRun completed", { runId, version, total });
  });

export const ingestAll = (
  linzApiKey: string | undefined,
  db: AddressDbService,
): Effect.Effect<IngestStart, HttpError> =>
  Effect.gen(function* () {
    const start = yield* startIngestion(linzApiKey, db);
    if (start.status !== "queued" || !start.runId || !start.version || start.total === undefined) {
      return start;
    }

    const total = start.total;
    const runId = start.runId;
    const version = start.version;
    const pages = Math.ceil(total / PAGE_SIZE);

    yield* Effect.logInfo("ingestAll started", { runId, version, total, pages });

    for (let page = 0; page < pages; page += 1) {
      const startIndex = page * PAGE_SIZE;
      const count = Math.min(PAGE_SIZE, total - startIndex);
      const collection = yield* fetchPage(linzApiKey!, startIndex, count);

      const values = (collection.features ?? []).flatMap((feature) => {
        const row = featureToValues(feature, version);
        return row ? [row] : [];
      });

      if (values.length) {
        yield* upsertPage(db, values);
      }
      yield* db.updateIngestionRun(runId, values.length);
      if ((page + 1) % 10 === 0) {
        yield* Effect.logInfo("ingestAll progress", {
          runId,
          page: page + 1,
          pages,
          total,
          version,
        });
      }
    }

    yield* db.finalizeIngestionRun(runId, "completed");
    yield* db.setDatasetVersion(version);
    yield* cleanupOldVersions(db, version);
    yield* db.rebuildSearchTerms;
    yield* Effect.logInfo("ingestAll completed", { runId, version, total });

    return start;
  });

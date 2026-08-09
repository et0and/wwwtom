import { Effect, Layer } from "effect";
import { layer as reactivityLayer } from "effect/unstable/reactivity/Reactivity";
import { PgClient } from "@effect/sql-pg";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { eq, type Assume } from "drizzle-orm";
import { Pool, types as pgTypes } from "pg";
import type { CustomTypesConfig } from "pg";
import { HttpError } from "@tom/types/errors";
import {
  ADDRESS_SCHEMA_STATEMENTS,
  SEARCH_ALIASES,
  datasetVersion,
  ingestionRuns,
  apiKeys,
  searchAliases,
} from "./schema";

/**
 * pg returns int8 columns as strings; the address dataset ids and counts are
 * all safe in a JS number, so parse them at the driver boundary.
 */
const int8AsNumber: CustomTypesConfig = {
  getTypeParser: (typeId, format) =>
    typeId === 20 ? (value: string) => Number(value) : pgTypes.getTypeParser(typeId, format),
};

export const dbError = (operation: string): HttpError =>
  new HttpError({ message: `Database error during ${operation}`, status: 500 });

/**
 * The pg Pool lives for the worker's lifetime (one pool per isolate, fronted
 * by Hyperdrive); the Drizzle client is built once around it via the pool
 * wrapper, which registers no finalizer so the pool survives request scopes.
 */
const makeDatabaseEffect = (pool: Pool) =>
  PgDrizzle.makeWithDefaults().pipe(
    Effect.provide(
      Layer.effect(PgClient.PgClient, PgClient.fromPool({ acquire: Effect.succeed(pool) })),
    ),
    Effect.provide(reactivityLayer),
  );

export type AddressDatabase = Effect.Success<ReturnType<typeof makeDatabaseEffect>>;

type DbRow = Record<string, string | number | boolean | null | undefined>;

export const runQuery = <T extends DbRow = DbRow>(
  database: AddressDatabase,
  query: SQL,
  operation: string,
): Effect.Effect<readonly Assume<T, object>[], HttpError> =>
  database.execute<T>(query).pipe(Effect.mapError(() => dbError(operation)));

export interface AddressDbService {
  readonly get: Effect.Effect<AddressDatabase, HttpError>;
  readonly ensureSchema: Effect.Effect<void, HttpError>;
  readonly rebuildSearchTerms: Effect.Effect<void, HttpError>;
  readonly getDatasetVersion: Effect.Effect<string | null, HttpError>;
  readonly setDatasetVersion: (version: string) => Effect.Effect<void, HttpError>;
  readonly createIngestionRun: (
    runId: string,
    version: string,
    total: number,
  ) => Effect.Effect<void, HttpError>;
  readonly updateIngestionRun: (runId: string, processed: number) => Effect.Effect<void, HttpError>;
  readonly finalizeIngestionRun: (runId: string, status: string) => Effect.Effect<void, HttpError>;
  readonly hasApiKey: (keyHash: string) => Effect.Effect<boolean, HttpError>;
  readonly insertApiKey: (keyHash: string) => Effect.Effect<void, HttpError>;
}

const TERM_COLUMNS: readonly (readonly [string, string])[] = [
  ["road_name", "road_name_ascii"],
  ["road_type", "road_type_name_ascii"],
  ["locality", "suburb_locality_ascii"],
  ["city", "town_city_ascii"],
];

const rebuildTermsForColumn = (
  database: AddressDatabase,
  kind: string,
  columnName: string,
): Effect.Effect<void, HttpError> =>
  runQuery(
    database,
    sql.raw(`
    INSERT INTO search_terms (normalized_term, canonical_term, kind, frequency)
    SELECT token, token, '${kind}', SUM(weight)
    FROM (
      SELECT value, COUNT(*) AS weight
      FROM (
        SELECT lower(regexp_replace(trim(${columnName}), '[^a-z0-9]+', ' ', 'g')) AS value
        FROM addresses
        WHERE ${columnName} IS NOT NULL AND trim(${columnName}) != ''
      ) grouped
      GROUP BY value
    ) source
    CROSS JOIN LATERAL regexp_split_to_table(source.value, ' ') AS token
    WHERE token != '' AND length(token) > 1
    GROUP BY token
    ON CONFLICT (normalized_term, kind) DO UPDATE SET
      canonical_term = EXCLUDED.canonical_term,
      frequency = EXCLUDED.frequency
  `),
    "rebuildSearchTerms",
  ).pipe(Effect.asVoid);

export const makeAddressDb = (connectionString: string): AddressDbService => {
  const pool = new Pool({
    connectionString,
    types: int8AsNumber,
    connectionTimeoutMillis: 5000,
  });
  let databasePromise: Promise<AddressDatabase> | undefined;
  let schemaReady = false;

  const get: Effect.Effect<AddressDatabase, HttpError> = Effect.tryPromise({
    try: () => {
      if (!databasePromise) {
        databasePromise = Effect.runPromise(makeDatabaseEffect(pool)).catch((error) => {
          databasePromise = undefined;
          throw error;
        });
      }
      return databasePromise;
    },
    catch: () => dbError("connect"),
  });

  const ensureSchema: Effect.Effect<void, HttpError> = Effect.gen(function* () {
    if (schemaReady) return;
    const database = yield* get;
    for (const statement of ADDRESS_SCHEMA_STATEMENTS) {
      yield* runQuery(database, sql.raw(statement), "ensureSchema");
    }
    yield* database
      .insert(searchAliases)
      .values([...SEARCH_ALIASES])
      .onConflictDoNothing()
      .pipe(Effect.mapError(() => dbError("ensureSchema")));
    schemaReady = true;
  });

  const rebuildSearchTerms: Effect.Effect<void, HttpError> = Effect.gen(function* () {
    const database = yield* get;
    yield* runQuery(database, sql`DELETE FROM search_terms`, "rebuildSearchTerms");
    for (const [kind, columnName] of TERM_COLUMNS) {
      yield* rebuildTermsForColumn(database, kind, columnName);
    }
  });

  const getDatasetVersion: Effect.Effect<string | null, HttpError> = Effect.gen(function* () {
    const database = yield* get;
    const rows = yield* runQuery<{ update_sequence: string }>(
      database,
      sql`SELECT update_sequence
           FROM dataset_version
           ORDER BY ingested_at DESC
           LIMIT 1`,
      "getDatasetVersion",
    );
    return rows[0]?.update_sequence ?? null;
  });

  const setDatasetVersion: (version: string) => Effect.Effect<void, HttpError> = (version) =>
    Effect.gen(function* () {
      const database = yield* get;
      const now = new Date().toISOString();
      yield* database
        .insert(datasetVersion)
        .values({ updateSequence: version, updatedAt: now, ingestedAt: now })
        .onConflictDoUpdate({
          target: datasetVersion.updateSequence,
          set: {
            updatedAt: sql`excluded.updated_at`,
            ingestedAt: sql`excluded.ingested_at`,
          },
        })
        .pipe(Effect.mapError(() => dbError("setDatasetVersion")));
    });

  const createIngestionRun: (
    runId: string,
    version: string,
    total: number,
  ) => Effect.Effect<void, HttpError> = (runId, version, total) =>
    Effect.gen(function* () {
      const database = yield* get;
      yield* database
        .insert(ingestionRuns)
        .values({
          runId,
          updateSequence: version,
          status: "running",
          startedAt: new Date().toISOString(),
          totalFeatures: total,
          processedFeatures: 0,
        })
        .onConflictDoNothing()
        .pipe(Effect.mapError(() => dbError("createIngestionRun")));
    });

  const updateIngestionRun: (runId: string, processed: number) => Effect.Effect<void, HttpError> = (
    runId,
    processed,
  ) =>
    Effect.gen(function* () {
      const database = yield* get;
      yield* database
        .update(ingestionRuns)
        .set({ processedFeatures: sql`${ingestionRuns.processedFeatures} + ${processed}` })
        .where(eq(ingestionRuns.runId, runId))
        .pipe(Effect.mapError(() => dbError("updateIngestionRun")));
    });

  const finalizeIngestionRun: (runId: string, status: string) => Effect.Effect<void, HttpError> = (
    runId,
    status,
  ) =>
    Effect.gen(function* () {
      const database = yield* get;
      yield* database
        .update(ingestionRuns)
        .set({ status, finishedAt: new Date().toISOString() })
        .where(eq(ingestionRuns.runId, runId))
        .pipe(Effect.mapError(() => dbError("finalizeIngestionRun")));
    });

  const hasApiKey: (keyHash: string) => Effect.Effect<boolean, HttpError> = (keyHash) =>
    Effect.gen(function* () {
      const database = yield* get;
      const rows = yield* runQuery<{ key_hash: string }>(
        database,
        sql`SELECT key_hash FROM api_keys WHERE key_hash = ${keyHash} AND enabled = 1 LIMIT 1`,
        "hasApiKey",
      );
      return rows.length > 0;
    });

  const insertApiKey: (keyHash: string) => Effect.Effect<void, HttpError> = (keyHash) =>
    Effect.gen(function* () {
      const database = yield* get;
      yield* database
        .insert(apiKeys)
        .values({ keyHash, createdAt: new Date().toISOString() })
        .onConflictDoNothing()
        .pipe(Effect.mapError(() => dbError("insertApiKey")));
    });

  return {
    get,
    ensureSchema,
    rebuildSearchTerms,
    getDatasetVersion,
    setDatasetVersion,
    createIngestionRun,
    updateIngestionRun,
    finalizeIngestionRun,
    hasApiKey,
    insertApiKey,
  };
};

import { Effect } from "effect";
import postgres from "postgres";
import { HttpError } from "@tom/types/errors";
import { buildRebuildTermsQuery, SQL } from "./queries";
import { ADDRESS_SCHEMA_STATEMENTS, SEARCH_ALIASES } from "./schema";

const dbError = (operation: string, cause: unknown): HttpError =>
  new HttpError({ message: `Database error during ${operation}`, status: 500, cause });

type PostgresSql = {
  unsafe: <T>(query: string, params?: readonly unknown[]) => Promise<readonly T[]>;
  end: () => Promise<void>;
} & ((strings: TemplateStringsArray, ...values: unknown[]) => Promise<readonly unknown[]>);

const getPostgres = (connectionString: string): Effect.Effect<PostgresSql, HttpError> =>
  Effect.gen(function* () {
    if (!connectionString) {
      return yield* new HttpError({ message: "Address database URL not configured", status: 500 });
    }

    const sql = yield* Effect.try({
      try: () =>
        postgres(connectionString, {
          max: 1,
          idle_timeout: 20,
          connect_timeout: 5,
        }) as PostgresSql,
      catch: (cause) => dbError("create postgres connection", cause),
    });

    return sql;
  });

export interface AddressDbService {
  readonly primary: Effect.Effect<PostgresSql, HttpError>;
  readonly replica: Effect.Effect<PostgresSql, HttpError>;
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

type VersionRow = { update_sequence: string };
type KeyRow = { key_hash: string };

export const makeAddressDb = (params: {
  primaryConnectionString: string;
  replicaConnectionString?: string;
}): AddressDbService => {
  const primaryConn = params.primaryConnectionString;
  const replicaConn = params.replicaConnectionString ?? params.primaryConnectionString;

  let primaryMemo: PostgresSql | undefined;
  let replicaMemo: PostgresSql | undefined;

  const primary = Effect.gen(function* () {
    if (primaryMemo) return primaryMemo;
    const sql = yield* getPostgres(primaryConn);
    primaryMemo = sql;
    return sql;
  });
  const replica = Effect.gen(function* () {
    if (replicaMemo) return replicaMemo;
    const sql = yield* getPostgres(replicaConn);
    replicaMemo = sql;
    return sql;
  });

  let schemaReady = false;

  const ensureSchema: Effect.Effect<void, HttpError> = Effect.gen(function* () {
    if (schemaReady) return;
    const sql = yield* primary;
    for (const statement of ADDRESS_SCHEMA_STATEMENTS) {
      yield* Effect.tryPromise({
        try: () => sql.unsafe<unknown>(statement),
        catch: (cause) => dbError("ensureSchema", cause),
      });
    }
    if (SEARCH_ALIASES.length) {
      yield* Effect.tryPromise({
        try: async () => {
          for (const { alias, expansion, priority } of SEARCH_ALIASES) {
            await sql.unsafe<unknown>(SQL.insertSearchAlias, [alias, expansion, priority]);
          }
        },
        catch: (cause) => dbError("seedSearchAliases", cause),
      });
    }
    schemaReady = true;
  });

  const rebuildSearchTerms: Effect.Effect<void, HttpError> = Effect.gen(function* () {
    const sql = yield* primary;
    const termColumns: readonly (readonly [string, string])[] = [
      ["road_name", "road_name_ascii"],
      ["road_type", "road_type_name_ascii"],
      ["locality", "suburb_locality_ascii"],
      ["city", "town_city_ascii"],
    ];

    yield* Effect.tryPromise({
      try: () => sql.unsafe<unknown>(SQL.deleteSearchTerms),
      catch: (cause) => dbError("rebuildSearchTerms", cause),
    });

    for (const [kind, columnName] of termColumns) {
      const query = buildRebuildTermsQuery(kind, columnName);
      yield* Effect.tryPromise({
        try: () => sql.unsafe<unknown>(query, [kind]),
        catch: (cause) => dbError("rebuildSearchTerms", cause),
      });
    }
  });

  const getDatasetVersion: Effect.Effect<string | null, HttpError> = Effect.gen(function* () {
    const sql = yield* replica;
    const rows = yield* Effect.tryPromise({
      try: () => sql.unsafe<VersionRow>(SQL.selectDatasetVersion),
      catch: (cause) => dbError("getDatasetVersion", cause),
    });
    return rows[0]?.update_sequence ?? null;
  });

  const setDatasetVersion: (version: string) => Effect.Effect<void, HttpError> = (version) =>
    Effect.gen(function* () {
      const sql = yield* primary;
      const now = new Date().toISOString();
      yield* Effect.tryPromise({
        try: () => sql.unsafe<unknown>(SQL.insertDatasetVersion, [version, now, now]),
        catch: (cause) => dbError("setDatasetVersion", cause),
      });
    });

  const createIngestionRun: (
    runId: string,
    version: string,
    total: number,
  ) => Effect.Effect<void, HttpError> = (runId, version, total) =>
    Effect.gen(function* () {
      const sql = yield* primary;
      const now = new Date().toISOString();
      yield* Effect.tryPromise({
        try: () =>
          sql.unsafe<unknown>(SQL.insertIngestionRun, [runId, version, "running", now, total]),
        catch: (cause) => dbError("createIngestionRun", cause),
      });
    });

  const updateIngestionRun: (runId: string, processed: number) => Effect.Effect<void, HttpError> = (
    runId,
    processed,
  ) =>
    Effect.gen(function* () {
      const sql = yield* primary;
      yield* Effect.tryPromise({
        try: () => sql.unsafe<unknown>(SQL.updateIngestionRun, [processed, runId]),
        catch: (cause) => dbError("updateIngestionRun", cause),
      });
    });

  const finalizeIngestionRun: (runId: string, status: string) => Effect.Effect<void, HttpError> = (
    runId,
    status,
  ) =>
    Effect.gen(function* () {
      const sql = yield* primary;
      const now = new Date().toISOString();
      yield* Effect.tryPromise({
        try: () => sql.unsafe<unknown>(SQL.finalizeIngestionRun, [status, now, runId]),
        catch: (cause) => dbError("finalizeIngestionRun", cause),
      });
    });

  const hasApiKey: (keyHash: string) => Effect.Effect<boolean, HttpError> = (keyHash) =>
    Effect.gen(function* () {
      const sql = yield* replica;
      const rows = yield* Effect.tryPromise({
        try: () => sql.unsafe<KeyRow>(SQL.selectKeyHash, [keyHash]),
        catch: (cause) => dbError("hasApiKey", cause),
      });
      return rows.length > 0;
    });

  const insertApiKey: (keyHash: string) => Effect.Effect<void, HttpError> = (keyHash) =>
    Effect.gen(function* () {
      const sql = yield* primary;
      yield* Effect.tryPromise({
        try: () => sql.unsafe<unknown>(SQL.insertApiKey, [keyHash, new Date().toISOString()]),
        catch: (cause) => dbError("insertApiKey", cause),
      });
    });

  return {
    primary,
    replica,
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

export const closeAddressDb = (_connectionString: string): Effect.Effect<void, HttpError> =>
  Effect.void;

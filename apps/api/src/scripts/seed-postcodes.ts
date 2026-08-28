import { Effect } from "effect";
// @ts-ignore -- node types not in Worker tsconfig, script runs via tsx with node
import { existsSync, readFileSync } from "node:fs";
import { makeAddressDb } from "../services/address/db";

const PREBUILT_PATH = "apps/api/scripts/postcodes.sql";

const getProcessEnv = (): Record<string, string | undefined> => {
  const maybeProcess = (globalThis as { process?: { env: Record<string, string | undefined> } })
    .process;
  return maybeProcess?.env ?? {};
};

const getEnv = (key: string): string | undefined => {
  const env = getProcessEnv();
  const direct = env[key];
  if (direct) return direct;
  const bundle = env.TOM_SECRETS;
  if (!bundle) return undefined;
  try {
    const parsed = JSON.parse(bundle) as Record<string, string>;
    return parsed[key];
  } catch {
    return undefined;
  }
};

const fetchPrebuiltSql = (url: string): Effect.Effect<string, Error> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      return response.text();
    },
    catch: (cause) => new Error(`fetch prebuilt failed: ${String(cause)}`),
  });

const executeSql = (
  sql: { unsafe: (query: string) => Promise<unknown> },
  text: string,
): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    const statements = text
      .split(";")
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    for (const statement of statements) {
      yield* Effect.tryPromise({
        try: () => sql.unsafe(`${statement};`),
        catch: (cause) => new Error(`execute failed: ${String(cause)}`),
      });
    }
  });

const main = Effect.gen(function* () {
  const addressDb = getEnv("ADDRESS_DB");
  if (!addressDb) {
    return yield* Effect.fail(new Error("ADDRESS_DB not configured"));
  }

  const db = makeAddressDb({
    primaryConnectionString: addressDb,
    replicaConnectionString: getEnv("ADDRESS_DB_REPLICA") ?? addressDb,
  });

  const sql = yield* db.primary;

  const customUrl = getEnv("POSTCODES_SQL_URL");
  if (customUrl) {
    yield* Effect.logInfo("seed-postcodes: fetching prebuilt from URL", { customUrl });
    const text = yield* fetchPrebuiltSql(customUrl);
    yield* executeSql(sql, text);
    yield* Effect.logInfo("seed-postcodes: done via URL");
    return;
  }

  if (existsSync(PREBUILT_PATH)) {
    yield* Effect.logInfo("seed-postcodes: using local prebuilt", { PREBUILT_PATH });
    const text = readFileSync(PREBUILT_PATH, "utf8");
    yield* executeSql(sql, text);
    yield* Effect.logInfo("seed-postcodes: done via local file");
    return;
  }

  yield* Effect.logWarning("seed-postcodes: no prebuilt found, skipping", {
    PREBUILT_PATH,
    hint: "Provide scripts/postcodes.sql or set POSTCODES_SQL_URL",
  });
});

Effect.runPromise(
  main.pipe(
    Effect.catch((error) =>
      Effect.logError("seed-postcodes failed", error).pipe(
        Effect.flatMap(() => Effect.fail(error)),
      ),
    ),
  ),
).catch((error) => {
  console.error("Seed postcodes failed:", error);
  const maybeExit = (globalThis as { process?: { exit: (code: number) => never } }).process?.exit;
  if (maybeExit) maybeExit(1);
});

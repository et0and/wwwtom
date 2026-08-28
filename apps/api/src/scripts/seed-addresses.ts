import { Effect } from "effect";
import { makeAddressDb } from "../services/address/db";
import { ingestAll } from "../services/address/ingest";

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

const main = Effect.gen(function* () {
  const addressDb = getEnv("ADDRESS_DB");
  const linzApiKey = getEnv("LINZ_API_KEY");

  if (!addressDb) {
    return yield* Effect.fail(
      new Error("ADDRESS_DB not configured. Set ADDRESS_DB or TOM_SECRETS with ADDRESS_DB"),
    );
  }
  if (!linzApiKey) {
    return yield* Effect.fail(
      new Error("LINZ_API_KEY not configured. Set LINZ_API_KEY or TOM_SECRETS with LINZ_API_KEY"),
    );
  }

  yield* Effect.logInfo("seed-addresses: starting", {
    addressDb: `${addressDb.slice(0, 30)}...`,
    linzKey: `${linzApiKey.slice(0, 6)}...`,
  });

  const db = makeAddressDb({
    primaryConnectionString: addressDb,
    replicaConnectionString: getEnv("ADDRESS_DB_REPLICA") ?? addressDb,
  });

  const result = yield* ingestAll(linzApiKey, db);

  yield* Effect.logInfo("seed-addresses: finished", result);
  console.log("Ingest result:", result);
});

Effect.runPromise(
  main.pipe(
    Effect.catch((error) =>
      Effect.logError("seed failed", error).pipe(Effect.flatMap(() => Effect.fail(error))),
    ),
  ),
).catch((error) => {
  console.error("Seed failed:", error);
  const maybeExit = (globalThis as { process?: { exit: (code: number) => never } }).process?.exit;
  if (maybeExit) maybeExit(1);
});

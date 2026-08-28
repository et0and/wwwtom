import * as Cloudflare from "alchemy/Cloudflare";
import { Effect, Redacted } from "effect";
import { InfrastructureConfigError } from "@tom/types/errors";
import { Stage } from "alchemy/Stage";
import { readSecretBundle } from "../shared.run.ts";

const parseDatabaseUrl = (
  url: string,
  variable: string,
): Effect.Effect<Cloudflare.Hyperdrive.PublicOrigin, InfrastructureConfigError> =>
  Effect.try({
    try: () => {
      const parsed = new URL(url);
      const scheme = parsed.protocol.replace(":", "");
      if (scheme !== "postgres" && scheme !== "postgresql") {
        throw new Error(`${variable} has unsupported scheme: ${scheme}`);
      }

      return {
        scheme,
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 5432,
        database: parsed.pathname.replace(/^\//, ""),
        user: decodeURIComponent(parsed.username),
        password: Redacted.make(decodeURIComponent(parsed.password)),
      };
    },
    catch: (cause) =>
      new InfrastructureConfigError({
        variable,
        message: `${variable} must be a PostgreSQL connection URL`,
        cause,
      }),
  });

export const addressHyperdrive = Effect.gen(function* () {
  const stage = yield* Stage;
  const bundle = yield* readSecretBundle("TOM_SECRETS");
  const addressDb = bundle.ADDRESS_DB;
  if (!addressDb) {
    return yield* new InfrastructureConfigError({
      variable: "TOM_SECRETS",
      message: "TOM_SECRETS must include ADDRESS_DB for the Hyperdrive origin",
    });
  }

  return yield* Cloudflare.Hyperdrive.Connection("wwwtom-address-hyperdrive", {
    ...(stage === "production" ? { name: "address-hyperdrive" } : undefined),
    origin: yield* parseDatabaseUrl(addressDb, "ADDRESS_DB"),
  });
});

export const addressReplicaHyperdrive = Effect.gen(function* () {
  const stage = yield* Stage;
  const bundle = yield* readSecretBundle("TOM_SECRETS");
  const replica = bundle.ADDRESS_DB_REPLICA;
  if (!replica) {
    // Replica is optional; fall back to primary when absent (dev, single-region)
    return undefined;
  }

  return yield* Cloudflare.Hyperdrive.Connection("wwwtom-address-replica-hyperdrive", {
    ...(stage === "production" ? { name: "address-replica-hyperdrive" } : undefined),
    origin: yield* parseDatabaseUrl(replica, "ADDRESS_DB_REPLICA"),
  });
});

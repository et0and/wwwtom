import * as Cloudflare from "alchemy/Cloudflare";
import { Effect, Redacted } from "effect";
import { InfrastructureConfigError } from "@tom/types/errors";
import { Stage } from "alchemy/Stage";
import { readSecretBundle } from "../shared.run.ts";

const parseDatabaseUrl = (
  url: string,
): Effect.Effect<Cloudflare.Hyperdrive.PublicOrigin, InfrastructureConfigError> =>
  Effect.try({
    try: () => {
      const parsed = new URL(url);
      const scheme = parsed.protocol.replace(":", "");
      if (scheme !== "postgres" && scheme !== "postgresql" && scheme !== "mysql") {
        throw new Error(`DATABASE_URL has unsupported scheme: ${scheme}`);
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
        variable: "DATABASE_URL",
        message: "DATABASE_URL must be a PostgreSQL or MySQL connection URL",
        cause,
      }),
  });

/**
 * Hyperdrive connection for the Sophie adapter worker. A separate resource
 * from the Tom Hyperdrive (see web.hyperdrive.ts) so connection pooling
 * and credentials stay tenant-scoped. The origin defaults to the shared
 * DATABASE_URL bundle value; a SOPHIE_DATABASE_URL bundle key overrides it
 * when the tenant needs its own database.
 */
export const sophieHyperdrive = Effect.gen(function* () {
  const stage = yield* Stage;
  const bundle = yield* readSecretBundle("TOM_SECRETS");
  const databaseUrl = bundle.SOPHIE_DATABASE_URL ?? bundle.DATABASE_URL;
  if (!databaseUrl) {
    return yield* new InfrastructureConfigError({
      variable: "TOM_SECRETS",
      message: "TOM_SECRETS must include DATABASE_URL for the Hyperdrive origin",
    });
  }

  return yield* Cloudflare.Hyperdrive.Connection("sophie-web-hyperdrive", {
    ...(stage === "production" ? { name: "sophie-guestbook-hyperdrive" } : undefined),
    origin: yield* parseDatabaseUrl(databaseUrl),
  });
});

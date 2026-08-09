import * as Cloudflare from "alchemy/Cloudflare";
import { Effect, Redacted } from "effect";
import { InfrastructureConfigError } from "@tom/types/errors";
import { readSecretBundle } from "../shared.run.ts";

const parseDatabaseUrl = (
  url: string,
): Effect.Effect<Cloudflare.Hyperdrive.PublicOrigin, InfrastructureConfigError> =>
  Effect.try({
    try: () => {
      const parsed = new URL(url);
      const scheme = parsed.protocol.replace(":", "");
      if (scheme !== "postgres" && scheme !== "postgresql") {
        throw new Error(`ADDRESS_DB has unsupported scheme: ${scheme}`);
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
        variable: "ADDRESS_DB",
        message: "ADDRESS_DB must be a PostgreSQL connection URL",
        cause,
      }),
  });

export const addressHyperdrive = Effect.gen(function* () {
  const bundle = yield* readSecretBundle("TOM_SECRETS");
  const addressDb = bundle.ADDRESS_DB;
  if (!addressDb) {
    return yield* new InfrastructureConfigError({
      variable: "TOM_SECRETS",
      message: "TOM_SECRETS must include ADDRESS_DB for the Hyperdrive origin",
    });
  }

  return yield* Cloudflare.Hyperdrive.Connection("wwwtom-address-hyperdrive", {
    origin: yield* parseDatabaseUrl(addressDb),
  });
});

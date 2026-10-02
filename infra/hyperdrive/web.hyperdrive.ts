import * as Cloudflare from "alchemy/Cloudflare";
import { Effect, Option, Redacted, Schema } from "effect";
import { PortNumber } from "@tom/schemas/env";
import { InfrastructureConfigError } from "@tom/types/errors";
import { Stage } from "alchemy/Stage";
import { readSecretBundle } from "../shared.run.ts";

/** Database schemes Hyperdrive can front. */
const DatabaseScheme = Schema.Literals(["postgres", "postgresql", "mysql"]);

/**
 * Default port per scheme. MySQL is not PostgreSQL: defaulting a
 * `mysql://host/db` URL to 5432 would point Hyperdrive at the wrong port and
 * surface as an opaque connect failure rather than a config error.
 */
const DEFAULT_PORTS = { postgres: 5432, postgresql: 5432, mysql: 3306 } as const;

export const parseDatabaseUrl = (
  url: string,
): Effect.Effect<Cloudflare.Hyperdrive.PublicOrigin, InfrastructureConfigError> =>
  Effect.try({
    try: () => {
      const parsed = new URL(url);
      const scheme = Schema.decodeUnknownSync(DatabaseScheme)(parsed.protocol.replace(":", ""));

      return {
        scheme,
        host: parsed.hostname,
        // An explicit port wins; otherwise the scheme's own default. A
        // malformed explicit port falls back to that default rather than
        // pointing the origin at NaN.
        port: Option.getOrElse(
          Schema.decodeUnknownOption(PortNumber)(parsed.port),
          () => DEFAULT_PORTS[scheme],
        ),
        database: parsed.pathname.replace(/^\//, ""),
        user: decodeURIComponent(parsed.username),
        password: Redacted.make(decodeURIComponent(parsed.password)),
      } satisfies Cloudflare.Hyperdrive.PublicOrigin;
    },
    catch: (cause) =>
      new InfrastructureConfigError({
        variable: "DATABASE_URL",
        message: "DATABASE_URL must be a PostgreSQL or MySQL connection URL",
        cause,
      }),
  });

export const webHyperdrive = Effect.gen(function* () {
  const stage = yield* Stage;
  const bundle = yield* readSecretBundle("TOM_SECRETS");
  const databaseUrl = bundle.DATABASE_URL;
  if (!databaseUrl) {
    return yield* new InfrastructureConfigError({
      variable: "TOM_SECRETS",
      message: "TOM_SECRETS must include DATABASE_URL for the Hyperdrive origin",
    });
  }

  return yield* Cloudflare.Hyperdrive.Connection("wwwtom-web-hyperdrive", {
    // Adopt the existing production config; other stages get their own.
    ...(stage === "production" ? { name: "guestbook-hyperdrive" } : undefined),
    origin: yield* parseDatabaseUrl(databaseUrl),
  });
});

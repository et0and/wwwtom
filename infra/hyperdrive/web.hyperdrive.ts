import * as Cloudflare from "@alchemy.run/cloudflare";
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

/**
 * The connection's physical name. Production adopts the existing config;
 * every other stage gets a deterministic per-stage name so one stage's
 * connection never collides with another's.
 */
export const hyperdriveName = (stage: string): string =>
  stage === "production" ? "guestbook-hyperdrive" : `wwwtom-web-hyperdrive-${stage}`;

/**
 * The Postgres connection behind the adapter's DatabaseService: the guestbook
 * tables today, with the are.na account tables on top of them.
 *
 * Only the adapter declares it. It is the only worker that reads
 * `databaseUrl` — the web worker binds no database at all — and a second
 * declarer mints a second connection per stage, because Alchemy's auto-naming
 * is prefixed with the stack name (see tom.queue.ts). That is what filled the
 * account's Hyperdrive quota.
 */
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
    name: hyperdriveName(stage),
    origin: yield* parseDatabaseUrl(databaseUrl),
  });
});

import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { ConfigError } from "effect/Config";
import { SourceError } from "effect/ConfigProvider";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { InfrastructureConfigError } from "@tom/types/errors";
import { secretBundle } from "./credentials.ts";
import { Database } from "./database.ts";
import { DatabaseToken } from "./databaseToken.ts";
import { Group } from "./group.ts";
import { providers as tursoProviders } from "./index.ts";
import { Location } from "./location.ts";

const DEFAULT_TOKEN_TTL_DAYS = 90;

/**
 * Deploy-time configuration. Explicit env wins over the bundle, matching the
 * rest of `infra/`. Nothing here is a secret — the platform token and the org
 * slug are credential-scoped and resolved in `credentials.ts`.
 */
const tursoConfig = Effect.gen(function* () {
  const bundle = secretBundle();
  const read = (name: string) => process.env[name] ?? bundle[name];

  const ttlRaw = read("TURSO_TOKEN_TTL_DAYS");
  const expiresInDays = ttlRaw === undefined ? DEFAULT_TOKEN_TTL_DAYS : Number.parseInt(ttlRaw, 10);
  if (Number.isNaN(expiresInDays) || expiresInDays <= 0) {
    return yield* new InfrastructureConfigError({
      variable: "TURSO_TOKEN_TTL_DAYS",
      message: "TURSO_TOKEN_TTL_DAYS must be a whole number of days greater than zero",
    });
  }

  return {
    group: read("TURSO_GROUP") ?? "default",
    location: read("TURSO_LOCATION"),
    sizeLimit: read("TURSO_SIZE_LIMIT"),
    expiresInDays,
  };
});

export default Stack(
  "wwwtom-turso",
  {
    providers: tursoProviders(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const stage = yield* Stage;
    const config = yield* tursoConfig;

    // Location and Group are shared by every stage: Turso gives an organization
    // one `default` group, and extra groups are limited to Scaler, Pro and
    // Enterprise plans. Declaring them outside production would let a preview
    // teardown delete the group every production database lives in.
    const isProduction = stage === "production";
    const location =
      isProduction && config.location !== undefined
        ? yield* Location("primary", { code: config.location })
        : undefined;
    const group = isProduction
      ? yield* Group("default", {
          name: config.group,
          // Only used to create the group; the provider refuses if the adopted
          // group sits somewhere else.
          ...(config.location !== undefined ? { location: config.location } : undefined),
        })
      : undefined;

    // Databases are the stage-scoped boundary. The logical id is stable and the
    // physical name carries the stage, so every stage in a stack run resolves to
    // the same name the app stacks expect.
    const databaseName = isProduction ? "wwwtom" : `wwwtom-${stage}`;
    const database = yield* Database("wwwtom", {
      name: databaseName,
      group: group?.name ?? config.group,
      ...(config.sizeLimit !== undefined ? { sizeLimit: config.sizeLimit } : undefined),
    });
    const token = yield* DatabaseToken("wwwtom", {
      database: database.name,
      expiresInDays: config.expiresInDays,
    });

    return {
      location: location?.code,
      group: group?.name ?? config.group,
      database: database.name,
      hostname: database.hostname,
      tokenDatabase: token.database,
      tokenExpiresAt: token.expiresAt,
    };
  }).pipe(
    Effect.mapError(
      (error) => new ConfigError(new SourceError({ message: error.message, cause: error })),
    ),
  ),
);

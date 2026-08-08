import * as Cloudflare from "alchemy/Cloudflare";
import { Effect, Redacted, Schema } from "effect";
import { ConfigError } from "effect/Config";
import { SourceError } from "effect/ConfigProvider";
import { InfrastructureConfigError } from "@tom/types/errors";
import { Stack } from "alchemy/Stack";

export const readSecretBundle = (
  name: string,
): Effect.Effect<Record<string, string>, InfrastructureConfigError> =>
  Effect.gen(function* () {
    const value = process.env[name];
    if (!value) {
      return yield* new InfrastructureConfigError({
        variable: name,
        message: `${name} is required to seed Cloudflare Secrets Store`,
      });
    }

    const parsed = yield* Effect.try({
      try: () => Schema.decodeUnknownSync(Schema.UnknownFromJsonString)(value),
      catch: (cause) =>
        new InfrastructureConfigError({
          variable: name,
          message: `${name} must be a JSON object secret bundle`,
          cause,
        }),
    });
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return yield* new InfrastructureConfigError({
        variable: name,
        message: `${name} must be a JSON object secret bundle`,
      });
    }

    const bundle: Record<string, string> = {};
    for (const [key, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof entry === "string") {
        bundle[key] = entry;
      }
    }
    return bundle;
  });

export const requireJsonSecret = (name: string): Effect.Effect<string, InfrastructureConfigError> =>
  Effect.map(readSecretBundle(name), () => process.env[name]!);

export const secretsStore = Cloudflare.SecretsStore.Store("wwwtom-secrets");

/**
 * Deterministic hostname for a per-stage app subdomain.
 * Production uses the bare subdomain (adapter.tom.so); other stages are
 * prefixed with the stage name (dev-adapter.tom.so).
 */
export const stageHost = (stage: string, sub: string): string =>
  stage === "production" ? `${sub}.tom.so` : `${stage}-${sub}.tom.so`;

/**
 * Hostname for the web app, which is an apex domain in production.
 */
export const stageWebHost = (stage: string): string =>
  stage === "production" ? "tom.so" : `${stage}-web.tom.so`;

export const tomSecrets = Effect.gen(function* () {
  const store = yield* secretsStore;

  return yield* Cloudflare.SecretsStore.Secret("TOM_SECRETS", {
    store,
    value: Redacted.make(yield* requireJsonSecret("TOM_SECRETS")),
    comment: "wwwtom secret bundle as a JSON object",
  });
});

export default Stack(
  "wwwtom",
  {
    providers: Cloudflare.providers() as never,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const [store, secrets] = yield* Effect.all([secretsStore, tomSecrets]);

    return {
      secretsStore: store.storeName,
      tomSecrets: secrets.secretName,
    };
  }).pipe(
    Effect.mapError(
      (error) => new ConfigError(new SourceError({ message: error.message, cause: error })),
    ),
  ),
);

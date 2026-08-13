import * as Cloudflare from "alchemy/Cloudflare";
import { retain } from "alchemy/RemovalPolicy";
import { Effect, Redacted, Schema } from "effect";
import { ConfigError } from "effect/Config";
import { SourceError } from "effect/ConfigProvider";
import { InfrastructureConfigError } from "@tom/types/errors";
import { TomSecretsSchema } from "@tom/schemas/secrets";
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

    return yield* Effect.try({
      try: () => Schema.decodeUnknownSync(TomSecretsSchema)(value),
      catch: (cause) =>
        new InfrastructureConfigError({
          variable: name,
          message: `${name} must be a JSON object of string values`,
          cause,
        }),
    });
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

  // The Secrets Store is account-level (one per account) and shared by
  // every stage, so this bundle is NOT stage-scoped. Retain it on teardown
  // so a per-stage `alchemy destroy` (e.g. the PR-preview cleanup) never
  // deletes the production TOM_SECRETS secret. The Store itself is already
  // never deleted by its provider.
  return yield* Cloudflare.SecretsStore.Secret("TOM_SECRETS", {
    store,
    value: Redacted.make(yield* requireJsonSecret("TOM_SECRETS")),
    comment: "wwwtom secret bundle as a JSON object",
  }).pipe(retain());
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

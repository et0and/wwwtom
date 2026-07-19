import * as Cloudflare from "alchemy/Cloudflare";
import { Effect, Redacted } from "effect";
import { InfrastructureConfigError } from "@tom/types/errors";
import { Stack } from "alchemy/Stack";

export const readSecretBundle = (
  name: string,
): Effect.Effect<Record<string, string>, InfrastructureConfigError> =>
  Effect.gen(function* () {
    const value = process.env[name];
    if (!value) {
      return yield* Effect.fail(
        new InfrastructureConfigError({
          variable: name,
          message: `${name} is required to seed Cloudflare Secrets Store`,
        }),
      );
    }

    const parsed = yield* Effect.try({
      try: () => JSON.parse(value) as unknown,
      catch: (cause) =>
        new InfrastructureConfigError({
          variable: name,
          message: `${name} must be a JSON object secret bundle`,
          cause,
        }),
    });
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return yield* Effect.fail(
        new InfrastructureConfigError({
          variable: name,
          message: `${name} must be a JSON object secret bundle`,
        }),
      );
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
  }),
);

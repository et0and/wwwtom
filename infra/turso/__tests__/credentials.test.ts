import { afterEach, describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { TursoCredentials, TursoCredentialsLive } from "../credentials.ts";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
});

/**
 * The layer reads `process.env` when it is built, which happens before the
 * inner effect runs, so the environment must be set before the effect exists.
 */
const withEnv = (env: Record<string, string | undefined>) => {
  process.env = { ...original, ...env };
  return Effect.gen(function* () {
    return yield* TursoCredentials;
  }).pipe(Effect.provide(TursoCredentialsLive));
};

describe("TursoCredentials", () => {
  it("reads the token and org slug from the TOM_SECRETS bundle", async () => {
    const bundle = JSON.stringify({ TURSO_ORG: "wwwtom", TURSO_API_TOKEN: "bundle-token" });

    const credentials = await Effect.runPromise(
      withEnv({ TOM_SECRETS: bundle, TURSO_ORG: undefined, TURSO_API_TOKEN: undefined }),
    );

    expect(credentials.organization).toBe("wwwtom");
    expect(Redacted.value(credentials.token)).toBe("bundle-token");
  });

  it("prefers explicit env over the bundle", async () => {
    const bundle = JSON.stringify({ TURSO_ORG: "bundle-org", TURSO_API_TOKEN: "bundle-token" });

    const credentials = await Effect.runPromise(
      withEnv({
        TOM_SECRETS: bundle,
        TURSO_ORG: "env-org",
        TURSO_API_TOKEN: "env-token",
      }),
    );

    expect(credentials.organization).toBe("env-org");
    expect(Redacted.value(credentials.token)).toBe("env-token");
  });

  it("fails closed when the bundle carries no token", async () => {
    const error = await Effect.runPromise(
      Effect.flip(withEnv({ TOM_SECRETS: JSON.stringify({ TURSO_ORG: "wwwtom" }) })),
    );

    expect(error).toMatchObject({ _tag: "CredentialsError" });
  });

  it("fails closed on a blank token", async () => {
    const error = await Effect.runPromise(
      Effect.flip(withEnv({ TURSO_ORG: "wwwtom", TURSO_API_TOKEN: "   " })),
    );

    expect(error).toMatchObject({ _tag: "CredentialsError" });
  });

  it("fails closed when the org slug is missing", async () => {
    const error = await Effect.runPromise(Effect.flip(withEnv({ TURSO_API_TOKEN: "token" })));

    expect(error).toMatchObject({ _tag: "CredentialsError" });
  });

  it("fails closed on a malformed bundle", async () => {
    const error = await Effect.runPromise(Effect.flip(withEnv({ TOM_SECRETS: "not json" })));

    expect(error).toMatchObject({ _tag: "CredentialsError" });
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { Effect, Schema } from "effect";
import { TomSecretsSchema } from "@tom/schemas/secrets";
import { InfrastructureConfigError } from "@tom/types/errors";
import { resolveDeploySecrets } from "../api.secrets.ts";

const MANAGED_ENV_KEYS = [
  "TOM_SECRETS",
  "TOM_CMS_ADMIN_EMAILS",
  "SOPHIE_CMS_ADMIN_EMAILS",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const;

type ManagedEnvKey = (typeof MANAGED_ENV_KEYS)[number];

const originalEnv = { ...process.env };

/** Set exactly the managed env keys given; delete the rest. */
const setEnv = (values: Partial<Record<ManagedEnvKey, string | undefined>>): void => {
  for (const key of MANAGED_ENV_KEYS) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

const bundle = {
  TOM_BETTER_AUTH_SECRET: "tom-auth",
  SOPHIE_BETTER_AUTH_SECRET: "sophie-auth",
  TOM_INTERNAL_API_TOKEN: "tom-internal",
  SOPHIE_INTERNAL_API_TOKEN: "sophie-internal",
  TOM_CMS_ADMIN_EMAILS: "tom-admin@example.com",
  SOPHIE_CMS_ADMIN_EMAILS: "sophie-admin@example.com",
  CMS_ADMIN_EMAILS: "shared-admin@example.com",
  GITHUB_CLIENT_ID: "github-id",
  GITHUB_CLIENT_SECRET: "github-secret",
  GOOGLE_CLIENT_ID: "google-id",
  GOOGLE_CLIENT_SECRET: "google-secret",
  UNRELATED: "kept",
} as const;

/** Seed TOM_SECRETS from the bundle fixture; undefined overrides drop keys. */
const setBundle = (
  overrides: Partial<Record<keyof typeof bundle, string | undefined>> = {},
): void => {
  const entries = Object.entries({ ...bundle, ...overrides }).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  );
  setEnv({ TOM_SECRETS: Schema.encodeSync(TomSecretsSchema)(Object.fromEntries(entries)) });
};

const resolveSecrets = (isAlchemyDev: boolean) =>
  Effect.runPromise(resolveDeploySecrets(isAlchemyDev));

const expectFailure = async (variable: string): Promise<void> => {
  const failure = await Effect.runPromise(Effect.flip(resolveDeploySecrets(false)));
  expect(failure).toBeInstanceOf(InfrastructureConfigError);
  expect(failure.variable).toBe(variable);
};

afterEach(() => {
  for (const key of MANAGED_ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("resolveDeploySecrets", () => {
  it("resolves allowlists and Google keys from the bundle", async () => {
    setBundle();
    const secrets = await resolveSecrets(false);
    expect(secrets).toMatchObject({
      tomAdminEmails: "tom-admin@example.com",
      sophieAdminEmails: "sophie-admin@example.com",
      sophieGoogleClientId: "google-id",
      sophieGoogleClientSecret: "google-secret",
      tomDevSecrets: {},
      sophieDevSecrets: {},
    });
  });

  it("prefers deploy-time env over the bundle", async () => {
    setBundle();
    setEnv({
      TOM_SECRETS: process.env.TOM_SECRETS,
      TOM_CMS_ADMIN_EMAILS: "env-tom@example.com",
      GOOGLE_CLIENT_ID: "env-google-id",
    });
    const secrets = await resolveSecrets(false);
    expect(secrets.tomAdminEmails).toBe("env-tom@example.com");
    expect(secrets.sophieGoogleClientId).toBe("env-google-id");
  });

  it("lets Tom fall back to the shared admin key", async () => {
    setBundle({ TOM_CMS_ADMIN_EMAILS: undefined });
    expect((await resolveSecrets(false)).tomAdminEmails).toBe("shared-admin@example.com");
  });

  it("never lets Sophie inherit the shared admin key", async () => {
    setBundle({ SOPHIE_CMS_ADMIN_EMAILS: undefined });
    await expectFailure("SOPHIE_CMS_ADMIN_EMAILS");
  });

  it("builds isolated per-tenant dev secret maps", async () => {
    setBundle();
    const { tomDevSecrets, sophieDevSecrets } = await resolveSecrets(true);
    expect(tomDevSecrets).toEqual({
      CMS_ADMIN_EMAILS: "shared-admin@example.com",
      GITHUB_CLIENT_ID: "github-id",
      GITHUB_CLIENT_SECRET: "github-secret",
      UNRELATED: "kept",
      BETTER_AUTH_SECRET: "tom-auth",
      INTERNAL_API_TOKEN: "tom-internal",
    });
    expect(sophieDevSecrets).toEqual({
      CMS_ADMIN_EMAILS: "shared-admin@example.com",
      GOOGLE_CLIENT_ID: "google-id",
      GOOGLE_CLIENT_SECRET: "google-secret",
      UNRELATED: "kept",
      BETTER_AUTH_SECRET: "sophie-auth",
      INTERNAL_API_TOKEN: "sophie-internal",
    });
  });

  it("omits dev overrides when the bundle lacks the tenant keys", async () => {
    setBundle({ TOM_BETTER_AUTH_SECRET: undefined, TOM_INTERNAL_API_TOKEN: undefined });
    const { tomDevSecrets } = await resolveSecrets(true);
    expect(tomDevSecrets).not.toHaveProperty("BETTER_AUTH_SECRET");
    expect(tomDevSecrets).not.toHaveProperty("INTERNAL_API_TOKEN");
  });

  it.each([
    {
      label: "an empty Tom allowlist",
      setup: () => setBundle({ TOM_CMS_ADMIN_EMAILS: " , " }),
      variable: "TOM_CMS_ADMIN_EMAILS",
    },
    {
      label: "a blank Google secret",
      setup: () => setBundle({ GOOGLE_CLIENT_SECRET: "   " }),
      variable: "GOOGLE_CLIENT_SECRET",
    },
    {
      label: "a blank env override",
      setup: () => {
        setBundle();
        setEnv({ TOM_SECRETS: process.env.TOM_SECRETS, GOOGLE_CLIENT_ID: "   " });
      },
      variable: "GOOGLE_CLIENT_ID",
    },
    {
      label: "a malformed bundle",
      setup: () => setEnv({ TOM_SECRETS: "not-json" }),
      variable: "TOM_CMS_ADMIN_EMAILS",
    },
  ])("fails closed on $label", async ({ setup, variable }) => {
    setup();
    await expectFailure(variable);
  });
});

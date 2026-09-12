import { describe, expect, it } from "vitest";
import { Effect, Redacted } from "effect";
import type { CloudflareEnv, PartialCloudflareEnv } from "../src/services/config";
import {
  AppConfig,
  makeAppConfigLayer,
  parseAdminEmails,
  readCloudflareEnv,
} from "../src/services/config";
import { SecretsError } from "@tom/types/errors";

describe("parseAdminEmails", () => {
  it("splits comma-separated emails into a string[]", () => {
    expect(parseAdminEmails("a@example.com,b@example.com")).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
  });

  it("trims whitespace and drops empty entries", () => {
    expect(parseAdminEmails(" a@example.com , , ")).toEqual(["a@example.com"]);
  });

  it("returns an empty list when unset", () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
  });
});

const bundleEnv = (bundle: Record<string, string>, overrides: Partial<CloudflareEnv> = {}) => ({
  TOM_SECRETS: { get: () => Promise.resolve(JSON.stringify(bundle)) },
  ...overrides,
});

const sharedBundle = {
  BETTER_AUTH_SECRET: "shared-secret",
  INTERNAL_API_TOKEN: "shared-token",
  CMS_ADMIN_EMAILS: "tom@example.com",
};

describe("readCloudflareEnv tenant secrets", () => {
  it("resolves Sophie bundle keys for the Sophie tenant", async () => {
    const resolved = await readCloudflareEnv(
      bundleEnv(
        {
          ...sharedBundle,
          SOPHIE_BETTER_AUTH_SECRET: "sophie-secret",
          SOPHIE_INTERNAL_API_TOKEN: "sophie-token",
          SOPHIE_CMS_ADMIN_EMAILS: "sophie@example.com",
        },
        { TENANT: "sophie" },
      ),
    );
    expect(resolved.BETTER_AUTH_SECRET).toBe("sophie-secret");
    expect(resolved.INTERNAL_API_TOKEN).toBe("sophie-token");
    expect(resolved.CMS_ADMIN_EMAILS).toBe("sophie@example.com");
  });

  it("falls back to shared secrets but never the shared allowlist for Sophie", async () => {
    const resolved = await readCloudflareEnv(bundleEnv(sharedBundle, { TENANT: "sophie" }));
    expect(resolved.BETTER_AUTH_SECRET).toBe("shared-secret");
    expect(resolved.INTERNAL_API_TOKEN).toBe("shared-token");
    expect(resolved.CMS_ADMIN_EMAILS).toBeUndefined();
  });

  it("resolves Tom bundle keys with fallback to shared values", async () => {
    const resolved = await readCloudflareEnv(
      bundleEnv({ ...sharedBundle, TOM_BETTER_AUTH_SECRET: "tom-secret" }, { TENANT: "tom" }),
    );
    expect(resolved.BETTER_AUTH_SECRET).toBe("tom-secret");
    expect(resolved.INTERNAL_API_TOKEN).toBe("shared-token");
    expect(resolved.CMS_ADMIN_EMAILS).toBe("tom@example.com");
  });

  it("keeps legacy behavior without a tenant tag", async () => {
    const resolved = await readCloudflareEnv(bundleEnv(sharedBundle));
    expect(resolved.BETTER_AUTH_SECRET).toBe("shared-secret");
    expect(resolved.CMS_ADMIN_EMAILS).toBe("tom@example.com");
  });

  it("lets explicit worker env win over every bundle value", async () => {
    const resolved = await readCloudflareEnv(
      bundleEnv(
        { ...sharedBundle, SOPHIE_CMS_ADMIN_EMAILS: "sophie@example.com" },
        { TENANT: "sophie", CMS_ADMIN_EMAILS: "explicit@example.com" },
      ),
    );
    expect(resolved.CMS_ADMIN_EMAILS).toBe("explicit@example.com");
  });

  it("lets explicit worker env win for provider keys over a stale bundle", async () => {
    const resolved = await readCloudflareEnv(
      bundleEnv(
        { ...sharedBundle, GOOGLE_CLIENT_ID: "stale-id", GOOGLE_CLIENT_SECRET: "stale-secret" },
        {
          TENANT: "sophie",
          CMS_ADMIN_EMAILS: "sophie@example.com",
          GOOGLE_CLIENT_ID: "explicit-id",
          GOOGLE_CLIENT_SECRET: "explicit-secret",
        },
      ),
    );
    expect(resolved.GOOGLE_CLIENT_ID).toBe("explicit-id");
    expect(resolved.GOOGLE_CLIENT_SECRET).toBe("explicit-secret");
  });

  it("falls back to bundle provider keys without explicit worker env", async () => {
    const resolved = await readCloudflareEnv(
      bundleEnv(
        { ...sharedBundle, GOOGLE_CLIENT_ID: "bundle-id", GOOGLE_CLIENT_SECRET: "bundle-secret" },
        { TENANT: "sophie", CMS_ADMIN_EMAILS: "sophie@example.com" },
      ),
    );
    expect(resolved.GOOGLE_CLIENT_ID).toBe("bundle-id");
    expect(resolved.GOOGLE_CLIENT_SECRET).toBe("bundle-secret");
  });

  it("throws SecretsError when TOM_SECRETS is not valid JSON", async () => {
    await expect(
      readCloudflareEnv({ TOM_SECRETS: { get: async () => "not-json" } }),
    ).rejects.toThrow(SecretsError);
  });

  it("drops unknown keys from the TOM_SECRETS bundle", async () => {
    const resolved = await readCloudflareEnv(
      bundleEnv({ INTERNAL_API_TOKEN: "token", UNKNOWN_KEY: "nope" }),
    );
    expect(resolved.INTERNAL_API_TOKEN).toBe("token");
    expect(Object.hasOwn(resolved, "UNKNOWN_KEY")).toBe(false);
  });
});

describe("makeAppConfigLayer", () => {
  const readConfig = (env: PartialCloudflareEnv) =>
    Effect.runPromise(
      Effect.gen(function* () {
        return yield* AppConfig;
      }).pipe(Effect.provide(makeAppConfigLayer(env))),
    );

  it("trims optional secrets and drops undefined/null placeholders", async () => {
    const trimmed = await readConfig({ ARENA_TOKEN: "  token  " });
    expect(trimmed.arenaToken ? Redacted.value(trimmed.arenaToken) : undefined).toBe("token");

    const placeholder = await readConfig({ ARENA_TOKEN: "undefined" });
    expect(placeholder.arenaToken).toBeUndefined();

    const nullPlaceholder = await readConfig({ ARENA_API_URL: "NULL" });
    expect(nullPlaceholder.arenaBaseUrl).toBeUndefined();
  });

  it("prefers the Hyperdrive connection string over DATABASE_URL", async () => {
    const resolved = await readConfig({
      DATABASE_URL: "postgres://direct",
      HYPERDRIVE: { connectionString: "postgres://pooled" },
    });
    expect(Redacted.value(resolved.databaseUrl)).toBe("postgres://pooled");
  });
});

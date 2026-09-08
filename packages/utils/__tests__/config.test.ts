import { describe, expect, it } from "vitest";
import type { CloudflareEnv } from "../src/services/config";
import { parseAdminEmails, readCloudflareEnv } from "../src/services/config";

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
});

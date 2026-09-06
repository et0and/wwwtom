import { describe, expect, it } from "vitest";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";
import type { CmsD1Binding } from "@tom/utils/services/config";

const detectingDb: CmsD1Binding = {
  prepare: () => {
    throw new Error("no database");
  },
  batch: () => Promise.resolve([]),
  exec: () => Promise.resolve({}),
};

const authed = (url: string, env: Parameters<typeof testEnv>[0]) =>
  app.fetch(
    requestWithEnv(url, testEnv(env), {
      headers: { [INTERNAL_TOKEN_HEADER]: "test-internal-token" },
    }),
  );

describe("auth routes", () => {
  it("rejects requests without the internal token", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/auth/ok", testEnv()));
    expect(response.status).toBe(401);
  });

  it("fails closed when auth storage is missing", async () => {
    const response = await authed("http://localhost/auth/ok", {
      BETTER_AUTH_SECRET: "test-secret-with-enough-entropy-0123456789",
      GITHUB_CLIENT_ID: "test-id",
      GITHUB_CLIENT_SECRET: "test-secret",
    });
    expect(response.status).toBe(500);
  });

  it("answers the ok probe with configured storage", async () => {
    const response = await authed("http://localhost/auth/ok", {
      CMS_D1: detectingDb,
      BETTER_AUTH_SECRET: "test-secret-with-enough-entropy-0123456789",
      GITHUB_CLIENT_ID: "test-id",
      GITHUB_CLIENT_SECRET: "test-secret",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});

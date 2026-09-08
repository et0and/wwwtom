import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { CmsError } from "@tom/types/errors";
import type { CmsD1Binding, CloudflareEnv } from "@tom/utils/services/config";
import {
  createAuth,
  createAuthFromEnv,
  isAdminEmail,
  memoryDatabase,
  parseAuthProviders,
  requireSession,
} from "../services/auth";
import type { MemorySeedRow } from "../services/auth";

const testAuth = () =>
  createAuth({
    database: memoryDatabase(),
    secret: "test-secret-with-enough-entropy-0123456789",
    baseURL: "http://localhost:8788",
    trustedOrigins: ["http://localhost:8788"],
    github: { clientId: "test-github-id", clientSecret: "test-github-secret" },
    adminEmails: ["tom@example.com"],
  });

describe("social providers", () => {
  it("enables Google only for Sophie", () => {
    const auth = createAuth({
      database: memoryDatabase(),
      secret: "test-secret-with-enough-entropy-0123456789",
      baseURL: "http://localhost:8790",
      trustedOrigins: ["http://localhost:8790"],
      google: { clientId: "test-google-id", clientSecret: "test-google-secret" },
      adminEmails: ["sophie@example.com"],
    });
    expect(auth.options.socialProviders?.google).toBeDefined();
    expect(auth.options.socialProviders?.github).toBeUndefined();
  });

  it("enables both providers when both configure", () => {
    const auth = createAuth({
      database: memoryDatabase(),
      secret: "test-secret-with-enough-entropy-0123456789",
      baseURL: "http://localhost:8788",
      trustedOrigins: ["http://localhost:8788"],
      github: { clientId: "test-github-id", clientSecret: "test-github-secret" },
      google: { clientId: "test-google-id", clientSecret: "test-google-secret" },
      adminEmails: ["tom@example.com"],
    });
    expect(auth.options.socialProviders?.github).toBeDefined();
    expect(auth.options.socialProviders?.google).toBeDefined();
  });

  it("gates Sophie to one Gmail account", () => {
    expect(isAdminEmail("sophie@example.com", ["sophie@example.com"])).toBe(true);
    expect(isAdminEmail("stranger@gmail.com", ["sophie@example.com"])).toBe(false);
  });
});

describe("isAdminEmail", () => {
  it("matches case-insensitively with whitespace tolerance", () => {
    expect(isAdminEmail("Tom@Example.COM ", [" tom@example.com "])).toBe(true);
  });

  it("denies strangers and empty allowlists", () => {
    expect(isAdminEmail("stranger@example.com", ["tom@example.com"])).toBe(false);
    expect(isAdminEmail("tom@example.com", [])).toBe(false);
    expect(isAdminEmail("tom@example.com", ["", "  "])).toBe(false);
  });
});

const stubDb: CmsD1Binding = {
  prepare: () => {
    throw new Error("no database");
  },
  batch: () => Promise.resolve([]),
  exec: () => Promise.resolve({}),
};

const bothProvidersEnv = (overrides: Partial<CloudflareEnv> = {}): CloudflareEnv => ({
  CMS_D1: stubDb,
  BETTER_AUTH_SECRET: "test-secret-with-enough-entropy-0123456789",
  GITHUB_CLIENT_ID: "test-github-id",
  GITHUB_CLIENT_SECRET: "test-github-secret",
  GOOGLE_CLIENT_ID: "test-google-id",
  GOOGLE_CLIENT_SECRET: "test-google-secret",
  ...overrides,
});

describe("parseAuthProviders", () => {
  it("parses case-insensitively with whitespace tolerance", () => {
    expect(parseAuthProviders(" GitHub, GOOGLE ")).toEqual(["github", "google"]);
  });

  it("keeps legacy behavior when unset or blank", () => {
    expect(parseAuthProviders(undefined)).toBeUndefined();
    expect(parseAuthProviders("  ")).toBeUndefined();
  });

  it("drops unknown providers so the caller fails closed", () => {
    expect(parseAuthProviders("sso")).toEqual([]);
  });
});

describe("createAuthFromEnv provider allowlist", () => {
  it("enables Google only for a Sophie-like env", async () => {
    const auth = await Effect.runPromise(
      createAuthFromEnv(bothProvidersEnv({ CMS_AUTH_PROVIDERS: "google" })),
    );
    expect(auth.options.socialProviders?.google).toBeDefined();
    expect(auth.options.socialProviders?.github).toBeUndefined();
  });

  it("enables GitHub only for a Tom-like env", async () => {
    const auth = await Effect.runPromise(
      createAuthFromEnv(bothProvidersEnv({ CMS_AUTH_PROVIDERS: "github" })),
    );
    expect(auth.options.socialProviders?.github).toBeDefined();
    expect(auth.options.socialProviders?.google).toBeUndefined();
  });

  it("keeps legacy behavior when the allowlist is unset", async () => {
    const auth = await Effect.runPromise(createAuthFromEnv(bothProvidersEnv()));
    expect(auth.options.socialProviders?.github).toBeDefined();
    expect(auth.options.socialProviders?.google).toBeDefined();
  });

  it("fails closed on an allowlist with no known provider", async () => {
    const error = await Effect.runPromise(
      Effect.flip(createAuthFromEnv(bothProvidersEnv({ CMS_AUTH_PROVIDERS: "sso" }))),
    );
    expect(error).toBeInstanceOf(CmsError);
  });

  it("reads a real allowlist string with whitespace/case variants", async () => {
    const auth = await Effect.runPromise(
      createAuthFromEnv(
        bothProvidersEnv({ CMS_ADMIN_EMAILS: " Admin@Example.COM , other@example.com " }),
      ),
    );
    const hook = auth.options.databaseHooks?.user?.create?.before;
    expect(hook).toBeDefined();
    const allowed = await hook?.({
      id: "user-1",
      email: "admin@example.com",
      emailVerified: false,
      name: "Admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(allowed).toBeUndefined();
    const denied = await hook?.({
      id: "user-2",
      email: "stranger@example.com",
      emailVerified: false,
      name: "Stranger",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(denied).toBe(false);
  });
});

describe("admin allowlist hook", () => {
  it("lets allowlisted emails create users", async () => {
    const auth = testAuth();
    const hook = auth.options.databaseHooks?.user?.create?.before;
    expect(hook).toBeDefined();
    const result = await hook?.({
      id: "user-1",
      email: "tom@example.com",
      emailVerified: false,
      name: "Tom",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result).toBeUndefined();
  });

  it("blocks strangers from creating users", async () => {
    const auth = testAuth();
    const hook = auth.options.databaseHooks?.user?.create?.before;
    const result = await hook?.({
      id: "user-2",
      email: "stranger@example.com",
      emailVerified: false,
      name: "Stranger",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(result).toBe(false);
  });
});

const userRow = {
  id: "user-1",
  email: "tom@example.com",
  emailVerified: true,
  name: "Tom",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const liveSessionRow = {
  id: "session-1",
  userId: "user-1",
  token: "live-token",
  expiresAt: new Date(Date.now() + 3600_000),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sessionAuth = (sessions: Array<MemorySeedRow>) =>
  createAuth({
    database: memoryDatabase({ user: [userRow], session: sessions }),
    secret: "test-secret-with-enough-entropy-0123456789",
    baseURL: "http://localhost:8788",
    trustedOrigins: ["http://localhost:8788"],
    github: { clientId: "test-github-id", clientSecret: "test-github-secret" },
    adminEmails: ["tom@example.com"],
  });

/** Sign a session token the way Better Auth signs cookies (HMAC-SHA256). */
const signedCookie = async (token: string, secret: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token));
  const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return encodeURIComponent(`${token}.${base64}`);
};

const sessionHeaders = (cookie: string): Headers =>
  new Headers({ cookie: `better-auth.session_token=${cookie}` });

describe("requireSession", () => {
  it("fails 401 without a session cookie", async () => {
    const result = await Effect.runPromise(Effect.flip(requireSession(testAuth(), new Headers())));
    expect(result).toBeInstanceOf(CmsError);
    expect(result.status).toBe(401);
  });

  it("returns the session user for a live token", async () => {
    const auth = sessionAuth([liveSessionRow]);
    const cookie = await signedCookie("live-token", "test-secret-with-enough-entropy-0123456789");
    const result = await Effect.runPromise(requireSession(auth, sessionHeaders(cookie)));
    expect(result.user.email).toBe("tom@example.com");
  });

  it("fails 401 for an expired token", async () => {
    const auth = sessionAuth([
      {
        ...liveSessionRow,
        id: "session-2",
        token: "expired-token",
        expiresAt: new Date(Date.now() - 3600_000),
      },
    ]);
    const cookie = await signedCookie(
      "expired-token",
      "test-secret-with-enough-entropy-0123456789",
    );
    const result = await Effect.runPromise(
      Effect.flip(requireSession(auth, sessionHeaders(cookie))),
    );
    expect(result).toBeInstanceOf(CmsError);
    expect(result.status).toBe(401);
  });
});

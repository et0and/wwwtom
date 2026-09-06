import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { CmsError } from "@tom/types/errors";
import { createAuth, isAdminEmail, memoryDatabase, requireSession } from "../services/auth";
import type { MemorySeedRow } from "../services/auth";

const testAuth = () =>
  createAuth({
    database: memoryDatabase(),
    secret: "test-secret-with-enough-entropy-0123456789",
    baseURL: "http://localhost:8788",
    trustedOrigins: ["http://localhost:8788"],
    githubClientId: "test-github-id",
    githubClientSecret: "test-github-secret",
    adminEmails: ["tom@example.com"],
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
    githubClientId: "test-github-id",
    githubClientSecret: "test-github-secret",
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

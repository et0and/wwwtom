import type { createAuth } from "../auth/operations";
import { memoryDatabase, type MemorySeedRow } from "./helpers";

type CreateAuth = typeof createAuth;

/** CMS admin user and live session the route tests sign in with. */
const adminUserRow: MemorySeedRow = {
  id: "user-1",
  email: "gh@tomhackshaw.com",
  emailVerified: true,
  name: "Tom",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const liveSessionRow: MemorySeedRow = {
  id: "session-1",
  userId: "user-1",
  token: "live-token",
  expiresAt: new Date(Date.now() + 3600_000),
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** Real Better Auth instance backed by the in-memory adapter. */
export const cmsSessionAuth = (createAuthFn: CreateAuth, secret: string) =>
  createAuthFn({
    database: memoryDatabase({ user: [adminUserRow], session: [liveSessionRow] }),
    secret,
    baseURL: "http://localhost:8788",
    trustedOrigins: ["http://localhost:8788"],
    github: { clientId: "test-github-id", clientSecret: "test-github-secret" },
    adminEmails: ["gh@tomhackshaw.com"],
  });

/** Sign a session token the way Better Auth signs cookies (HMAC-SHA256). */
export const signedSessionCookie = async (
  secret: string,
  token = "live-token",
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token));
  const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `better-auth.session_token=${encodeURIComponent(`${token}.${base64}`)}`;
};

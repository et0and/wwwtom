import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Effect } from "effect";
import type { CloudflareEnv } from "@tom/utils/config";
import { closeDb } from "@tom/db/service";
import { startTestDatabase, type TestDatabase } from "@tom/db/testing";
import { app } from "../index";
import {
  fetchMock,
  jsonResponse,
  requestWithEnv,
  stubFetch,
  testEnv,
  unstubFetch,
} from "../test/helpers";

beforeEach(stubFetch);
afterEach(unstubFetch);

const ADAPTER_URL = "http://localhost:8788";
const RETURN_URL = "http://localhost:3000";

/**
 * The are.na OAuth flow stores its PKCE session in Postgres, so these routes
 * are exercised against a real engine: startTestDatabase boots an in-process
 * PGlite over the Postgres wire protocol and applies the migrations.
 */
let testDb: TestDatabase;
let env: CloudflareEnv;

beforeAll(async () => {
  testDb = await startTestDatabase();
  env = testEnv({
    TENANT: "tom",
    DATABASE_URL: testDb.connectionString,
    ADAPTER_URL,
    ARENA_RETURN_URL: RETURN_URL,
    ARENA_CLIENT_ID: "client-123",
    ARENA_CLIENT_SECRET: "secret-456",
  });
}, 60_000);

afterAll(async () => {
  await Effect.runPromise(closeDb(testDb.connectionString));
  await testDb.close();
});

beforeEach(async () => {
  await testDb.db.deleteFrom("arena_accounts").execute();
  await testDb.db.deleteFrom("arena_oauth_sessions").execute();
});

/** Match are.na requests by pathname, so no query string can confuse a stub. */
const stubArena = (routes: ReadonlyArray<readonly [string, unknown]>): void => {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const match = routes.find(([pathname]) => url.pathname === pathname);
    return match ? jsonResponse(match[1]) : jsonResponse({ message: "Not found" }, 404);
  });
};

/** The cookie pair a browser would replay from a Set-Cookie response. */
const cookieHeader = (response: Response): string =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0] ?? "")
    .filter((pair) => pair !== "")
    .join("; ");

const cookieValue = (response: Response, name: string): string | undefined =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0] ?? "")
    .find((pair) => pair.startsWith(`${name}=`))
    ?.slice(name.length + 1);

const startHandshake = async (): Promise<{ authUrl: string; cookies: string; state: string }> => {
  const response = await app.fetch(
    requestWithEnv(`${ADAPTER_URL}/arena/auth/initiate`, env, { method: "POST" }),
  );
  const body = await response.json();
  const authUrl: string = body.authUrl;
  const state = new URL(authUrl).searchParams.get("state") ?? "";
  return { authUrl, cookies: cookieHeader(response), state };
};

const ARENA_TOKEN = {
  access_token: "arena-token",
  created_at: 1_700_000_000,
  scope: "read write",
  token_type: "Bearer",
};

const ARENA_ME = {
  id: 42,
  type: "User",
  name: "Tom Hackshaw",
  slug: "tom",
  avatar: "https://images.are.na/avatar.png",
  initials: "TH",
};

/** Complete the handshake and return the durable arena_session cookie. */
const completeHandshake = async (): Promise<string> => {
  const { cookies, state } = await startHandshake();
  stubArena([
    ["/v3/oauth/token", ARENA_TOKEN],
    ["/v3/me", ARENA_ME],
  ]);
  const response = await app.fetch(
    requestWithEnv(`${ADAPTER_URL}/arena/callback?code=abc&state=${state}`, env, {
      headers: { Cookie: cookies },
    }),
  );
  return `arena_session=${cookieValue(response, "arena_session") ?? ""}`;
};

describe("arena oauth integration", () => {
  describe("POST /arena/auth/initiate", () => {
    it("builds the are.na authorize URL and stores the PKCE session", async () => {
      const { authUrl, cookies, state } = await startHandshake();

      const url = new URL(authUrl);
      expect(url.origin + url.pathname).toBe("https://www.are.na/oauth/authorize");
      expect(url.searchParams.get("client_id")).toBe("client-123");
      expect(url.searchParams.get("redirect_uri")).toBe(`${ADAPTER_URL}/arena/callback`);
      expect(url.searchParams.get("response_type")).toBe("code");
      expect(url.searchParams.get("scope")).toBe("read write");
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      expect(url.searchParams.get("code_challenge")).toBeTruthy();
      expect(state).toBeTruthy();
      expect(cookies).toContain("arena_oauth_session=");

      const sessions = await testDb.db.selectFrom("arena_oauth_sessions").selectAll().execute();
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.state).toBe(state);
      expect(sessions[0]?.code_verifier).toBeTruthy();
    });
  });

  describe("GET /arena/callback", () => {
    it("exchanges the code, stores the account, and redirects back", async () => {
      const { cookies, state } = await startHandshake();
      stubArena([
        ["/v3/oauth/token", ARENA_TOKEN],
        ["/v3/me", ARENA_ME],
      ]);

      const response = await app.fetch(
        requestWithEnv(`${ADAPTER_URL}/arena/callback?code=abc&state=${state}`, env, {
          headers: { Cookie: cookies },
        }),
      );

      expect(response.status).toBe(302);
      const location = new URL(response.headers.get("location") ?? "");
      expect(location.origin).toBe(RETURN_URL);
      expect(location.pathname).toBe("/");
      expect(location.search).toBe("");

      const account = await testDb.db
        .selectFrom("arena_accounts")
        .selectAll()
        .executeTakeFirstOrThrow();
      expect(account.arena_user_id).toBe(42);
      expect(account.arena_user_name).toBe("Tom Hackshaw");
      expect(account.access_token).toBe("arena-token");
      expect(account.session_id).toBeTruthy();

      // The transient PKCE cookie is cleared and the durable session is set.
      const setCookies = response.headers.getSetCookie();
      expect(setCookies.some((cookie) => cookie.startsWith("arena_session="))).toBe(true);
      expect(setCookies.some((cookie) => cookie.startsWith("arena_oauth_session=;"))).toBe(true);
      expect(await testDb.db.selectFrom("arena_oauth_sessions").selectAll().execute()).toHaveLength(
        0,
      );
    });

    it("refuses a callback whose state does not match the session", async () => {
      const { cookies } = await startHandshake();
      stubArena([
        ["/v3/oauth/token", ARENA_TOKEN],
        ["/v3/me", ARENA_ME],
      ]);

      const response = await app.fetch(
        requestWithEnv(`${ADAPTER_URL}/arena/callback?code=abc&state=not-the-state`, env, {
          headers: { Cookie: cookies },
        }),
      );

      expect(response.status).toBe(302);
      const location = new URL(response.headers.get("location") ?? "");
      expect(location.origin).toBe(RETURN_URL);
      expect(location.searchParams.get("arena_error")).toBe("auth_failed");
      expect(await testDb.db.selectFrom("arena_accounts").selectAll().execute()).toHaveLength(0);
    });
  });

  describe("GET /arena/me", () => {
    it("returns the signed-in are.na user for the session", async () => {
      const sessionCookie = await completeHandshake();

      const response = await app.fetch(
        requestWithEnv(`${ADAPTER_URL}/arena/me`, env, { headers: { Cookie: sessionCookie } }),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        id: 42,
        name: "Tom Hackshaw",
        slug: "tom",
        avatarUrl: "https://images.are.na/avatar.png",
      });
    });

    it("returns null when signed out", async () => {
      const response = await app.fetch(requestWithEnv(`${ADAPTER_URL}/arena/me`, env));

      expect(response.status).toBe(200);
      expect(await response.json()).toBeNull();
    });
  });

  describe("POST /arena/logout", () => {
    it("deletes the account and clears the session", async () => {
      const sessionCookie = await completeHandshake();

      const response = await app.fetch(
        requestWithEnv(`${ADAPTER_URL}/arena/logout`, env, {
          method: "POST",
          headers: { Cookie: sessionCookie },
        }),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(await testDb.db.selectFrom("arena_accounts").selectAll().execute()).toHaveLength(0);
      expect(
        response.headers.getSetCookie().some((cookie) => cookie.startsWith("arena_session=;")),
      ).toBe(true);
    });
  });
});

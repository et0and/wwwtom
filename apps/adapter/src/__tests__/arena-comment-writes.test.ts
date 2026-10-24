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
const SESSION_ID = "session-abc";

let testDb: TestDatabase;
let env: CloudflareEnv;

beforeAll(async () => {
  testDb = await startTestDatabase();
  env = testEnv({ TENANT: "tom", DATABASE_URL: testDb.connectionString, ADAPTER_URL });
}, 60_000);

afterAll(async () => {
  await Effect.runPromise(closeDb(testDb.connectionString));
  await testDb.close();
});

beforeEach(async () => {
  await testDb.db.deleteFrom("arena_accounts").execute();
});

/** Seed a signed-in account and return its browser cookie. */
const signIn = async (): Promise<string> => {
  await testDb.db
    .insertInto("arena_accounts")
    .values({
      session_id: SESSION_ID,
      arena_user_id: 42,
      arena_user_slug: "tom",
      arena_user_name: "Tom Hackshaw",
      arena_user_avatar_url: null,
      access_token: "arena-token",
    })
    .execute();
  return `arena_session=${SESSION_ID}`;
};

const COMMENT = {
  id: 5,
  type: "Comment",
  body: { markdown: "Nice one", html: "<p>Nice one</p>", plain: "Nice one" },
  created_at: "2026-02-01T00:00:00Z",
  updated_at: "2026-02-01T00:00:00Z",
  user: { id: 42, type: "User", name: "Tom Hackshaw", slug: "tom", avatar: null, initials: "TH" },
  _links: { self: { href: "https://api.are.na/v3/comments/5" } },
};

/** The request are.na actually received, normalised from (url, init) or Request. */
const arenaRequest = (index = 0): Request => {
  const call = fetchMock.mock.calls[index] ?? [];
  const input = call[0];
  if (input instanceof Request) return input;
  return new Request(String(input), call[1] as RequestInit | undefined);
};

const postComment = async (cookie: string | undefined, body: { body: string }): Promise<Response> =>
  app.fetch(
    requestWithEnv(`${ADAPTER_URL}/arena/blocks/101/comments`, env, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie !== undefined && { Cookie: cookie }),
      },
      body: JSON.stringify(body),
    }),
  );

describe("arena comment writes", () => {
  describe("POST /arena/blocks/:id/comments", () => {
    it("posts the comment as the signed-in are.na user", async () => {
      const cookie = await signIn();
      fetchMock.mockResolvedValue(jsonResponse(COMMENT, 201));

      const response = await postComment(cookie, { body: "Nice one" });

      expect(response.status).toBe(200);
      expect((await response.json()).id).toBe(5);

      const request = arenaRequest();
      expect(request.method).toBe("POST");
      expect(new URL(request.url).pathname).toBe("/v3/blocks/101/comments");
      expect(request.headers.get("authorization")).toBe("Bearer arena-token");
      await expect(request.clone().json()).resolves.toEqual({ body: "Nice one" });
    });

    it("refuses to post without an are.na session", async () => {
      fetchMock.mockResolvedValue(jsonResponse(COMMENT, 201));

      const response = await postComment(undefined, { body: "Nice one" });

      expect(response.status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects an empty comment before reaching are.na", async () => {
      const cookie = await signIn();
      fetchMock.mockResolvedValue(jsonResponse(COMMENT, 201));

      const response = await postComment(cookie, { body: "" });

      expect(response.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /arena/comments/:id", () => {
    it("deletes the comment as the signed-in are.na user", async () => {
      const cookie = await signIn();
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

      const response = await app.fetch(
        requestWithEnv(`${ADAPTER_URL}/arena/comments/5`, env, {
          method: "DELETE",
          headers: { Cookie: cookie },
        }),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });

      const request = arenaRequest();
      expect(request.method).toBe("DELETE");
      expect(new URL(request.url).pathname).toBe("/v3/comments/5");
      expect(request.headers.get("authorization")).toBe("Bearer arena-token");
    });

    it("refuses to delete without an are.na session", async () => {
      const response = await app.fetch(
        requestWithEnv(`${ADAPTER_URL}/arena/comments/5`, env, { method: "DELETE" }),
      );

      expect(response.status).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

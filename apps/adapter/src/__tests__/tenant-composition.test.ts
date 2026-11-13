import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ARENA_POSTS_CHANNEL_SLUG } from "@tom/constants/arena";
import { app } from "../index";
import { SIMULATOR_HEADER } from "../simulator";
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

const tomEnv = (overrides: Record<string, string> = {}) =>
  testEnv({ TENANT: "tom", API_URL: "http://localhost:8787", ...overrides });
const sophieEnv = (overrides: Record<string, string> = {}) =>
  testEnv({ TENANT: "sophie", API_URL: "http://localhost:8787", ...overrides });

const listBody = {
  docs: [],
  totalDocs: 0,
  limit: 5,
  page: 1,
  totalPages: 0,
  hasNextPage: false,
  hasPrevPage: false,
};

const stubArenaPosts = (): void => {
  fetchMock.mockImplementation(async (input: RequestInfo) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === `/v3/channels/${ARENA_POSTS_CHANNEL_SLUG}/contents`) {
      return jsonResponse({
        meta: {
          current_page: 1,
          per_page: 5,
          total_pages: 1,
          total_count: 0,
          has_more_pages: false,
        },
        data: [],
      });
    }
    return jsonResponse({ message: "Not found" }, 404);
  });
};

const guestbookEntry = {
  id: 1,
  fediverse_username: "tom",
  fediverse_instance: "mastodon.social",
  display_name: "Tom",
  avatar_url: null,
  message: "hello",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("tenant route composition", () => {
  it("does not expose CMS reads to the Tom adapter", async () => {
    for (const path of ["/content/posts", "/content/posts/hello-world", "/content/categories"]) {
      const response = await app.fetch(requestWithEnv(`http://localhost${path}`, tomEnv()));
      expect(response.status).toBe(404);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not expose the CMS write surface to the Tom adapter", async () => {
    const response = await app.fetch(
      requestWithEnv("http://localhost/content/posts", tomEnv(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://tom.so",
          cookie: "better-auth.session_token=abc",
        },
        body: "{}",
      }),
    );
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves CMS reads on the Sophie adapter", async () => {
    fetchMock.mockResolvedValue(jsonResponse(listBody));
    const response = await app.fetch(requestWithEnv("http://localhost/content/posts", sophieEnv()));
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8787/posts?page=1&pageSize=5",
      expect.anything(),
    );
  });

  it("does not expose are.na routes to the Sophie adapter", async () => {
    for (const path of [
      "/arena/channels",
      "/arena/users/tom",
      "/content/arena/posts",
      "/content/arena/feed",
    ]) {
      const response = await app.fetch(requestWithEnv(`http://localhost${path}`, sophieEnv()));
      expect(response.status).toBe(404);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves are.na reads on the Tom adapter", async () => {
    stubArenaPosts();
    const response = await app.fetch(
      requestWithEnv("http://localhost/content/arena/posts", tomEnv()),
    );
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("does not expose guestbook routes to the Sophie adapter", async () => {
    const response = await app.fetch(
      requestWithEnv("http://localhost/guestbook/entries", sophieEnv(), {
        headers: { [SIMULATOR_HEADER]: "1" },
      }),
    );
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves guestbook entries on the Tom adapter", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ results: [guestbookEntry], page: 1, page_size: 100, total_count: 1 }),
    );
    const response = await app.fetch(
      requestWithEnv(
        "http://localhost/guestbook/entries",
        tomEnv({ SIMULATOR_URL: "http://localhost:8789" }),
        { headers: { [SIMULATOR_HEADER]: "1" } },
      ),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([guestbookEntry]);
  });
});

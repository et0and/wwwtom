import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

const tomEnv = testEnv({ TENANT: "tom" });

const markdown = (text: string) => ({ markdown: text, html: `<p>${text}</p>`, plain: text });

const comment = (id: number, text: string) => ({
  id,
  type: "Comment",
  body: markdown(text),
  created_at: "2026-02-01T00:00:00Z",
  updated_at: "2026-02-01T00:00:00Z",
  user: {
    id: 7,
    type: "User",
    name: "Tom",
    slug: "tom",
    avatar: "https://images.are.na/avatar.png",
    initials: "TH",
  },
  _links: { self: { href: `https://api.are.na/v3/comments/${id}` } },
});

const commentsEnvelope = (data: ReadonlyArray<unknown>) => ({
  meta: {
    current_page: 1,
    per_page: 24,
    total_pages: 1,
    total_count: data.length,
    has_more_pages: false,
  },
  data,
});

/** Match are.na requests by pathname, so no query string can confuse a stub. */
const stubArena = (routes: ReadonlyArray<readonly [string, unknown]>): void => {
  fetchMock.mockImplementation(async (input: RequestInfo) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const match = routes.find(([path]) => url.pathname === path);
    return match ? jsonResponse(match[1]) : jsonResponse({ message: "Not found" }, 404);
  });
};

const requestedUrls = (): string[] =>
  fetchMock.mock.calls.map((call) => {
    const [input] = call as [RequestInfo, RequestInit | undefined];
    return input instanceof Request ? input.url : String(input);
  });

describe("arena comments integration", () => {
  describe("GET /arena/blocks/:id/comments", () => {
    it("returns the block's comments", async () => {
      stubArena([["/v3/blocks/101/comments", commentsEnvelope([comment(1, "Nice one")])]]);

      const response = await app.fetch(
        requestWithEnv("http://localhost/arena/blocks/101/comments", tomEnv),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.map((item: { body: { plain: string } }) => item.body.plain)).toEqual([
        "Nice one",
      ]);
      expect(requestedUrls().some((url) => url.includes("/v3/blocks/101/comments"))).toBe(true);
    });

    it("returns an empty thread for a block with no comments", async () => {
      stubArena([["/v3/blocks/202/comments", commentsEnvelope([])]]);

      const response = await app.fetch(
        requestWithEnv("http://localhost/arena/blocks/202/comments", tomEnv),
      );

      expect(response.status).toBe(200);
      expect((await response.json()).data).toEqual([]);
    });
  });
});

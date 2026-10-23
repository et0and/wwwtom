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
const sophieEnv = testEnv({ TENANT: "sophie" });

const POSTS_CHANNEL = "/v3/channels/posts-fwj0hyy6cee";
const WORK_CHANNEL = "/v3/channels/work-usxogi1u-ta";

const markdown = (text: string) => ({ markdown: text, html: `<p>${text}</p>`, plain: text });

const indexItem = (fields: {
  id: number;
  slug: string;
  title: string;
  summary?: string;
  connectedAt: string;
}) => ({
  id: fields.id,
  type: "Channel",
  slug: fields.slug,
  title: fields.title,
  description: fields.summary === undefined ? null : markdown(fields.summary),
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  counts: { blocks: 0, channels: 0 },
  connection: {
    connected_at: fields.connectedAt,
    pinned: false,
  },
});

const textBlock = (id: number, text: string) => ({ id, type: "Text", content: markdown(text) });

const contentsEnvelope = (data: ReadonlyArray<unknown>) => ({
  meta: {
    current_page: 1,
    per_page: 10,
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

const requestedUrlFor = (fragment: string): string => {
  const found = requestedUrls().find((url) => url.includes(fragment));
  if (found === undefined) throw new Error(`No request matched ${fragment}`);
  return found;
};

describe("arena content integration", () => {
  describe("GET /content/arena/posts", () => {
    it("lists posts from the master channel", async () => {
      stubArena([
        [
          `${POSTS_CHANNEL}/contents`,
          contentsEnvelope([
            indexItem({
              id: 12,
              slug: "second-post-def456",
              title: "Second post",
              connectedAt: "2026-02-02T00:00:00Z",
            }),
            indexItem({
              id: 11,
              slug: "first-post-abc123",
              title: "First post",
              summary: "First summary",
              connectedAt: "2026-02-01T00:00:00Z",
            }),
          ]),
        ],
      ]);

      const response = await app.fetch(
        requestWithEnv("http://localhost/content/arena/posts?page=1&pageSize=5", tomEnv),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.docs.map((doc: { slug: string }) => doc.slug)).toEqual([
        "second-post",
        "first-post",
      ]);
      expect(body).toMatchObject({ totalDocs: 2, page: 1, hasNextPage: false });
      expect(response.headers.get("Cache-Control")).toContain("public");
      expect(response.headers.get("Cache-Control")).toContain("s-maxage=3600");
      const contentsUrl = new URL(requestedUrlFor(`${POSTS_CHANNEL}/contents`));
      expect(contentsUrl.searchParams.get("sort")).toBe("position_desc");
      expect(contentsUrl.searchParams.get("per")).toBe("5");
    });

    it("never caches session reads", async () => {
      stubArena([[`${POSTS_CHANNEL}/contents`, contentsEnvelope([])]]);

      const response = await app.fetch(
        requestWithEnv("http://localhost/content/arena/posts", tomEnv, {
          headers: { cookie: "better-auth.session_token=abc" },
        }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    });
  });

  describe("GET /content/arena/posts/:slug", () => {
    it("returns the post with its blocks", async () => {
      stubArena([
        [
          `${POSTS_CHANNEL}/contents`,
          contentsEnvelope([
            indexItem({
              id: 11,
              slug: "first-post-abc123",
              title: "First post",
              summary: "First summary",
              connectedAt: "2026-02-03T00:00:00Z",
            }),
          ]),
        ],
        [
          "/v3/channels/first-post-abc123/contents",
          contentsEnvelope([textBlock(101, "Hello"), textBlock(102, "World")]),
        ],
      ]);

      const response = await app.fetch(
        requestWithEnv("http://localhost/content/arena/posts/first-post", tomEnv),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        slug: "first-post",
        arenaSlug: "first-post-abc123",
        title: "First post",
        summary: "First summary",
        publishedAt: "2026-02-03T00:00:00Z",
      });
      expect(body.blocks.map((block: { type: string }) => block.type)).toEqual(["Text", "Text"]);
      expect(response.headers.get("Cache-Control")).toContain("public");
    });

    it("maps an unpublished post to an RFC 9457 problem", async () => {
      stubArena([[`${POSTS_CHANNEL}/contents`, contentsEnvelope([])]]);

      const response = await app.fetch(
        requestWithEnv("http://localhost/content/arena/posts/draft-post-abc123", tomEnv),
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        type: "https://errors.tom.so/not-found",
        status: 404,
        title: "Post not found",
        instance: "http://localhost/content/arena/posts/draft-post-abc123",
      });
      expect(response.headers.get("Cache-Control") ?? "").not.toContain("public");
    });
  });

  describe("GET /content/arena/works", () => {
    it("lists works from the work master channel", async () => {
      stubArena([
        [
          `${WORK_CHANNEL}/contents`,
          contentsEnvelope([
            indexItem({
              id: 21,
              slug: "project-one-abc123",
              title: "Project one",
              connectedAt: "2026-02-01T00:00:00Z",
            }),
          ]),
        ],
      ]);

      const response = await app.fetch(
        requestWithEnv("http://localhost/content/arena/works", tomEnv),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.docs.map((doc: { slug: string }) => doc.slug)).toEqual(["project-one"]);
    });

    it("returns a work with its blocks", async () => {
      stubArena([
        [
          `${WORK_CHANNEL}/contents`,
          contentsEnvelope([
            indexItem({
              id: 21,
              slug: "project-one-abc123",
              title: "Project one",
              summary: "A project",
              connectedAt: "2026-02-01T00:00:00Z",
            }),
          ]),
        ],
        ["/v3/channels/project-one-abc123/contents", contentsEnvelope([textBlock(101, "Hello")])],
      ]);

      const response = await app.fetch(
        requestWithEnv("http://localhost/content/arena/works/project-one", tomEnv),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({ slug: "project-one", summary: "A project" });
      expect(body.blocks).toHaveLength(1);
    });
  });

  describe("GET /content/arena/feed", () => {
    it("maps posts to feed docs", async () => {
      stubArena([
        [
          `${POSTS_CHANNEL}/contents`,
          contentsEnvelope([
            indexItem({
              id: 11,
              slug: "first-post-abc123",
              title: "First post",
              summary: "First summary",
              connectedAt: "2026-02-01T00:00:00Z",
            }),
          ]),
        ],
      ]);

      const response = await app.fetch(
        requestWithEnv("http://localhost/content/arena/feed?limit=2", tomEnv),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        docs: [
          {
            id: 11,
            title: "First post",
            summary: "First summary",
            slug: "first-post",
            publishedAt: "2026-02-01T00:00:00Z",
            content: "First summary",
          },
        ],
      });
      const feedUrl = new URL(requestedUrlFor(`${POSTS_CHANNEL}/contents`));
      expect(feedUrl.searchParams.get("per")).toBe("2");
    });
  });

  describe("tenant gating", () => {
    it("hides are.na routes from the Sophie tenant", async () => {
      for (const path of ["/content/arena/posts", "/content/arena/works"]) {
        const response = await app.fetch(requestWithEnv(`http://localhost${path}`, sophieEnv));
        expect(response.status).toBe(404);
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("keeps the D1 CMS routes for the Sophie tenant", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ docs: [], totalDocs: 0, limit: 5, page: 1, totalPages: 0 }),
      );

      const response = await app.fetch(requestWithEnv("http://localhost/content/posts", sophieEnv));

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8787/posts?page=1&pageSize=5",
        expect.anything(),
      );
    });
  });
});

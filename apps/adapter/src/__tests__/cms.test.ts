import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { jsonResponse, requestWithEnv, testEnv } from "../test/helpers";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const env = testEnv({ API_URL: "http://localhost:8787" });

const post = {
  id: "post-1",
  slug: "hello-world",
  title: "Hello World",
  summary: "A summary",
  content: {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      { type: "arena", attrs: { slug: "toms-place", title: "Tom's Place" } },
    ],
  },
  html: "<p>Hello</p>",
  status: "published",
  publishedAt: "2026-09-01T00:00:00.000Z",
  heroMediaId: null,
  categories: [],
  meta: { title: null, description: null, image: null },
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-02T00:00:00.000Z",
};

const listBody = {
  docs: [post],
  totalDocs: 1,
  limit: 5,
  page: 2,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: true,
};

describe("cms integration", () => {
  describe("GET /content/posts", () => {
    it("proxies pagination to the API and returns the list", async () => {
      fetchMock.mockResolvedValue(jsonResponse(listBody));
      const response = await app.fetch(
        requestWithEnv("http://localhost/content/posts?page=2&pageSize=5", env),
      );
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8787/posts?page=2&pageSize=5",
        expect.anything(),
      );
      expect(await response.json()).toEqual(listBody);
    });

    it("marks anonymous reads cacheable at the edge", async () => {
      fetchMock.mockResolvedValue(jsonResponse(listBody));
      const response = await app.fetch(
        requestWithEnv("http://localhost/content/posts?page=1&pageSize=5", env),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toContain("public");
      expect(response.headers.get("Cache-Control")).toContain("s-maxage=300");
    });

    it("never caches session reads", async () => {
      fetchMock.mockResolvedValue(jsonResponse(listBody));
      const response = await app.fetch(
        requestWithEnv("http://localhost/content/posts?page=1&pageSize=5", env, {
          headers: { cookie: "better-auth.session_token=abc" },
        }),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    });

    it("forwards the category filter to the API", async () => {
      fetchMock.mockResolvedValue(jsonResponse(listBody));
      const response = await app.fetch(
        requestWithEnv("http://localhost/content/posts?category=pages", env),
      );
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8787/posts?page=1&pageSize=5&category=pages",
        expect.anything(),
      );
    });
  });

  describe("GET /content/posts/:slug", () => {
    it("returns the post from the API with arena refs", async () => {
      fetchMock.mockResolvedValue(jsonResponse(post));
      const response = await app.fetch(
        requestWithEnv("http://localhost/content/posts/hello-world", env),
      );
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8787/posts/hello-world",
        expect.anything(),
      );
      expect(await response.json()).toEqual({
        ...post,
        arenaBlocks: [{ slug: "toms-place", title: "Tom's Place" }],
      });
    });

    it("maps an API 404 to an RFC 9457 problem", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ title: "Not found" }, 404));
      const response = await app.fetch(
        requestWithEnv("http://localhost/content/posts/missing", env),
      );
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        type: "https://errors.tom.so/not-found",
        status: 404,
        title: "CMS post not found",
        instance: "http://localhost/content/posts/missing",
      });
    });

    it("never caches error responses at the edge", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ title: "Not found" }, 404));
      const response = await app.fetch(
        requestWithEnv("http://localhost/content/posts/missing", env),
      );
      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control") ?? "").not.toContain("public");
    });
  });

  describe("GET /content/works", () => {
    it("proxies to the API works list", async () => {
      fetchMock.mockResolvedValue(jsonResponse(listBody));
      const response = await app.fetch(requestWithEnv("http://localhost/content/works", env));
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8787/works?page=1&pageSize=10",
        expect.anything(),
      );
    });

    it("rejects the category filter instead of ignoring it", async () => {
      fetchMock.mockResolvedValue(jsonResponse(listBody));
      for (const path of [
        "/content/works?category=essays",
        "/content/works/summary?category=essays",
      ]) {
        fetchMock.mockClear();
        const response = await app.fetch(requestWithEnv(`http://localhost${path}`, env));
        expect(response.status).toBe(400);
        expect(fetchMock).not.toHaveBeenCalled();
      }
    });
  });

  describe("GET /content/posts/summary", () => {
    it("proxies pagination to the API summaries endpoint, not the slug route", async () => {
      fetchMock.mockResolvedValue(jsonResponse(listBody));
      const response = await app.fetch(
        requestWithEnv("http://localhost/content/posts/summary?page=1&pageSize=5", env),
      );
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8787/posts/summary?page=1&pageSize=5",
        expect.anything(),
      );
      expect(await response.json()).toEqual(listBody);
    });

    it("marks anonymous summary reads cacheable at the edge", async () => {
      fetchMock.mockResolvedValue(jsonResponse(listBody));
      const response = await app.fetch(
        requestWithEnv("http://localhost/content/posts/summary", env),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toContain("public");
    });

    it("never caches summary session reads", async () => {
      fetchMock.mockResolvedValue(jsonResponse(listBody));
      const response = await app.fetch(
        requestWithEnv("http://localhost/content/posts/summary", env, {
          headers: { cookie: "better-auth.session_token=abc" },
        }),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    });
  });

  describe("GET /content/works/summary", () => {
    it("proxies to the API work summaries endpoint, not the slug route", async () => {
      fetchMock.mockResolvedValue(jsonResponse(listBody));
      const response = await app.fetch(
        requestWithEnv("http://localhost/content/works/summary", env),
      );
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8787/works/summary?page=1&pageSize=10",
        expect.anything(),
      );
    });
  });

  describe("GET /content/feed", () => {
    it("maps posts to feed docs with HTML content", async () => {
      fetchMock.mockResolvedValue(jsonResponse(listBody));
      const response = await app.fetch(
        requestWithEnv("http://localhost/content/feed?limit=2", env),
      );
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8787/posts?page=1&pageSize=2",
        expect.anything(),
      );
      expect(await response.json()).toEqual({
        docs: [
          {
            id: "post-1",
            title: "Hello World",
            summary: "A summary",
            slug: "hello-world",
            publishedAt: "2026-09-01T00:00:00.000Z",
            content: "<p>Hello</p>",
          },
        ],
      });
    });
  });

  describe("GET /content/categories", () => {
    it("returns the categories from the API", async () => {
      const categories = [{ id: "cat-1", slug: "essays", title: "Essays" }];
      fetchMock.mockResolvedValue(jsonResponse(categories));
      const response = await app.fetch(requestWithEnv("http://localhost/content/categories", env));
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith("http://localhost:8787/categories", expect.anything());
      expect(await response.json()).toEqual(categories);
    });
  });

  describe("draft access", () => {
    it("forwards the status filter and session cookie to the API", async () => {
      fetchMock.mockResolvedValue(jsonResponse(listBody));
      const response = await app.fetch(
        requestWithEnv("http://localhost/content/posts?status=all", env, {
          headers: { cookie: "better-auth.session_token=abc" },
        }),
      );
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://localhost:8787/posts?page=1&pageSize=5&status=all");
      expect(new Headers(init.headers).get("cookie")).toBe("better-auth.session_token=abc");
    });

    it("forwards the session cookie on single-post reads", async () => {
      fetchMock.mockResolvedValue(jsonResponse(post));
      await app.fetch(
        requestWithEnv("http://localhost/content/posts/hello-world", env, {
          headers: { cookie: "better-auth.session_token=abc" },
        }),
      );
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(new Headers(init.headers).get("cookie")).toBe("better-auth.session_token=abc");
    });

    it("forwards the bearer credential and never caches bearer reads", async () => {
      fetchMock.mockResolvedValue(jsonResponse(listBody));
      const response = await app.fetch(
        requestWithEnv("http://localhost/content/posts?page=1&pageSize=5", env, {
          headers: { authorization: "Bearer test-token" },
        }),
      );
      expect(response.status).toBe(200);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-token");
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    });

    it("forwards the session cookie on feed reads", async () => {
      fetchMock.mockResolvedValue(jsonResponse(listBody));
      await app.fetch(
        requestWithEnv("http://localhost/content/feed?limit=2", env, {
          headers: { cookie: "better-auth.session_token=abc" },
        }),
      );
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(new Headers(init.headers).get("cookie")).toBe("better-auth.session_token=abc");
    });
  });
});

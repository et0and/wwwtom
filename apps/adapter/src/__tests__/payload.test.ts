import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { jsonResponse, payloadPostsResponse, requestWithEnv, testEnv } from "../test/helpers";

const env = testEnv();

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const postsFetchUrl = (page = 1, pageSize = 5) =>
  `https://cms.tom.so/api/posts?sort=-publishedAt&limit=${pageSize}&page=${page}&depth=1`;

describe("payload integration", () => {
  describe("GET /payload/posts", () => {
    it("maps a successful Payload response into data + pagination meta", async () => {
      fetchMock.mockResolvedValue(jsonResponse(payloadPostsResponse));
      const response = await app.fetch(
        requestWithEnv("http://localhost/payload/posts?page=2&pageSize=5", env),
      );
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(postsFetchUrl(2, 5), expect.anything());
      const body = await response.json();
      expect(body).toEqual({
        data: payloadPostsResponse.docs,
        meta: {
          pagination: {
            page: 1,
            pageSize: 5,
            pageCount: 1,
            total: 1,
          },
        },
      });
    });

    it("applies default pagination when no query params are sent", async () => {
      fetchMock.mockResolvedValue(jsonResponse(payloadPostsResponse));
      await app.fetch(requestWithEnv("http://localhost/payload/posts", env));
      expect(fetchMock).toHaveBeenCalledWith(postsFetchUrl(1, 5), expect.anything());
    });

    it("returns an empty page instead of failing when Payload errors", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: "boom" }, 500));
      const response = await app.fetch(requestWithEnv("http://localhost/payload/posts", env));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({
        data: [],
        meta: {
          pagination: {
            page: 1,
            pageSize: 1,
            pageCount: 0,
            total: 0,
          },
        },
      });
    });
  });

  describe("GET /payload/posts/:slug", () => {
    it("returns the mapped post for a slug", async () => {
      fetchMock.mockResolvedValue(jsonResponse(payloadPostsResponse));
      const response = await app.fetch(
        requestWithEnv("http://localhost/payload/posts/a-pattern-language", env),
      );
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(
          "/api/posts?where%5Bslug%5D%5Bequals%5D=a-pattern-language&limit=1&depth=3",
        ),
        expect.anything(),
      );
      const body = await response.json();
      expect(body.slug).toBe("a-pattern-language");
      expect(body.content).toBe("<p>Some content</p>");
      expect(body.arenaBlocks).toEqual([]);
      expect(body.id).toBe("34");
    });

    it("returns an empty body when no post matches the slug", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ ...payloadPostsResponse, docs: [] }));
      const response = await app.fetch(
        requestWithEnv("http://localhost/payload/posts/missing", env),
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("");
    });

    it("returns an empty body when Payload errors, even after the no-cache retry", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: "boom" }, 500));
      const response = await app.fetch(
        requestWithEnv("http://localhost/payload/posts/erroring", env),
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("");
    });
  });

  describe("GET /payload/works", () => {
    it("returns the works list", async () => {
      const works = { docs: [{ id: 1, title: "Hyperjam", slug: "hyperjam" }] };
      fetchMock.mockResolvedValue(jsonResponse(works));
      const response = await app.fetch(requestWithEnv("http://localhost/payload/works", env));
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://cms.tom.so/api/works?sort=title",
        expect.anything(),
      );
      expect(await response.json()).toEqual(works.docs);
    });

    it("sorts by the query param when provided", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ docs: [] }));
      await app.fetch(requestWithEnv("http://localhost/payload/works?sort=-updatedAt", env));
      expect(fetchMock).toHaveBeenCalledWith(
        "https://cms.tom.so/api/works?sort=-updatedAt",
        expect.anything(),
      );
    });

    it("returns an empty list instead of failing when Payload errors", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: "boom" }, 500));
      const response = await app.fetch(requestWithEnv("http://localhost/payload/works", env));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([]);
    });
  });

  describe("GET /payload/works/:slug", () => {
    it("returns the work with converted content", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ docs: [{ id: 1, title: "Hyperjam", slug: "hyperjam", content: "html" }] }),
      );
      const response = await app.fetch(
        requestWithEnv("http://localhost/payload/works/hyperjam", env),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.slug).toBe("hyperjam");
      expect(body.content).toBe("html");
      expect(body.arenaBlocks).toEqual([]);
    });

    it("returns an empty body when no work matches the slug", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ docs: [] }));
      const response = await app.fetch(
        requestWithEnv("http://localhost/payload/works/missing", env),
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("");
    });

    it("returns an empty body when Payload errors after the no-cache retry", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: "boom" }, 500));
      const response = await app.fetch(
        requestWithEnv("http://localhost/payload/works/erroring", env),
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("");
    });
  });

  describe("GET /payload/feed", () => {
    it("returns posts with converted content for the feed", async () => {
      fetchMock.mockResolvedValue(jsonResponse(payloadPostsResponse));
      const response = await app.fetch(
        requestWithEnv("http://localhost/payload/feed?limit=20", env),
      );
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://cms.tom.so/api/posts?sort=-publishedAt&limit=20&depth=3",
        expect.anything(),
      );
      const body = await response.json();
      expect(body.docs).toEqual([
        {
          id: "34",
          title: "A pattern language",
          summary: "On imagining a monorepo as a shared house",
          slug: "a-pattern-language",
          publishedAt: "2026-06-30T00:00:00.000Z",
          content: "<p>Some content</p>",
        },
      ]);
    });

    it("returns an empty feed instead of failing when Payload errors", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: "boom" }, 500));
      const response = await app.fetch(requestWithEnv("http://localhost/payload/feed", env));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ docs: [] });
    });
  });
});

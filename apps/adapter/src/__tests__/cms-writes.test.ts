import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";
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

const env = testEnv({
  API_URL: "http://localhost:8787",
  ADAPTER_URL: "http://localhost:8788",
  INTERNAL_API_TOKEN: "adapter-token",
});

const sessionBody = { session: { id: "session-1" }, user: { id: "user-1" } };

const noSessionBody = { session: null, user: null };

const writeRequest = <B>(url: string, method: string, body?: B): Request =>
  requestWithEnv(url, env, {
    method,
    headers: {
      "Content-Type": "application/json",
      cookie: "better-auth.session_token=abc",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const sessionCall = () => {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, init };
};

const writeCall = (index = 1) => {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { url, init };
};

const headerOf = (init: RequestInit, name: string): string | null =>
  new Headers(init.headers).get(name);

describe("cms write proxy", () => {
  describe("POST /content/posts", () => {
    it("checks the session then forwards the write with token and cookies", async () => {
      const created = { id: "post-1", slug: "hello-world" };
      fetchMock
        .mockResolvedValueOnce(jsonResponse(sessionBody))
        .mockResolvedValueOnce(jsonResponse(created));
      const response = await app.fetch(
        writeRequest("http://localhost/content/posts", "POST", { slug: "hello-world" }),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(created);

      expect(sessionCall().url).toBe("http://localhost:8787/auth/get-session");
      expect(headerOf(sessionCall().init, "cookie")).toBe("better-auth.session_token=abc");
      expect(headerOf(sessionCall().init, INTERNAL_TOKEN_HEADER)).toBe("adapter-token");

      expect(writeCall().url).toBe("http://localhost:8787/posts");
      expect(writeCall().init.method).toBe("POST");
      expect(headerOf(writeCall().init, INTERNAL_TOKEN_HEADER)).toBe("adapter-token");
      expect(headerOf(writeCall().init, "cookie")).toBe("better-auth.session_token=abc");
      const forwarded = writeCall().init.body as ArrayBuffer;
      expect(new TextDecoder().decode(forwarded)).toContain("hello-world");
    });

    it("rejects anonymous writes with 401 without touching the API", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(noSessionBody));
      const response = await app.fetch(
        writeRequest("http://localhost/content/posts", "POST", { slug: "hello-world" }),
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        type: "https://errors.tom.so/unauthorized",
        status: 401,
        title: "CMS session required",
        instance: "http://localhost/content/posts",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("passes API errors through with their status", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(sessionBody))
        .mockResolvedValueOnce(jsonResponse({ title: "Conflict" }, 409));
      const response = await app.fetch(
        writeRequest("http://localhost/content/posts", "POST", { slug: "hello-world" }),
      );
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ title: "Conflict" });
    });

    it("returns 502 if session fetch throws", async () => {
      fetchMock.mockRejectedValueOnce(new Error("connection refused"));
      const response = await app.fetch(
        writeRequest("http://localhost/content/posts", "POST", { slug: "hello-world" }),
      );
      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({
        type: "about:blank",
        status: 502,
        title: "CMS auth unavailable",
        instance: "http://localhost/content/posts",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("rejects writes with no cookie with 401", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(noSessionBody));
      const response = await app.fetch(
        requestWithEnv("http://localhost/content/posts", env, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: "hello-world" }),
        }),
      );
      expect(response.status).toBe(401);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(new Headers(init.headers).get("cookie")).toBeNull();
    });
  });

  describe("write origin gate", () => {
    const originRequest = (origin: string): Request =>
      requestWithEnv("http://localhost/content/posts", env, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: "better-auth.session_token=abc",
          origin,
        },
        body: JSON.stringify({ slug: "hello-world" }),
      });

    it("rejects cross-site writes with 403 without touching the API", async () => {
      const response = await app.fetch(originRequest("https://evil.com"));
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        type: "https://errors.tom.so/forbidden",
        status: 403,
        title: "Untrusted write origin",
        instance: "http://localhost/content/posts",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects unknown tom.so subdomains with 403 without touching the API", async () => {
      const response = await app.fetch(originRequest("https://evil.tom.so"));
      expect(response.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("allows the deployed editor origin", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(sessionBody))
        .mockResolvedValueOnce(jsonResponse({ id: "post-1" }));
      const response = await app.fetch(originRequest("https://dev-cms.tom.so"));
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("rejects untrusted referers with 403", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/content/posts", env, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: "better-auth.session_token=abc",
            referer: "https://evil.com/page",
          },
          body: JSON.stringify({ slug: "hello-world" }),
        }),
      );
      expect(response.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("allows the local editor origin", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(sessionBody))
        .mockResolvedValueOnce(jsonResponse({ id: "post-1" }));
      const response = await app.fetch(originRequest("http://localhost:5173"));
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("prefers Origin over Referer if both exist", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(sessionBody))
        .mockResolvedValueOnce(jsonResponse({ id: "post-1" }));
      const response = await app.fetch(
        requestWithEnv("http://localhost/content/posts", env, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: "better-auth.session_token=abc",
            origin: "http://localhost:5173",
            referer: "https://evil.com/page",
          },
          body: JSON.stringify({ slug: "hello-world" }),
        }),
      );
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("rejects evil Origin even if Referer is trusted", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/content/posts", env, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: "better-auth.session_token=abc",
            origin: "https://evil.com",
            referer: "http://localhost:5173/page",
          },
          body: JSON.stringify({ slug: "hello-world" }),
        }),
      );
      expect(response.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("PUT /content/posts/:slug", () => {
    it("forwards to the API post path", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(sessionBody))
        .mockResolvedValueOnce(jsonResponse({ id: "post-1" }));
      const response = await app.fetch(
        writeRequest("http://localhost/content/posts/hello-world", "PUT", { title: "Hi" }),
      );
      expect(response.status).toBe(200);
      expect(writeCall().url).toBe("http://localhost:8787/posts/hello-world");
      expect(writeCall().init.method).toBe("PUT");
    });
  });

  describe("DELETE /content/works/:slug", () => {
    it("forwards the delete", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(sessionBody))
        .mockResolvedValueOnce(jsonResponse({ id: "work-1" }));
      const response = await app.fetch(
        writeRequest("http://localhost/content/works/hyperjam", "DELETE"),
      );
      expect(response.status).toBe(200);
      expect(writeCall().url).toBe("http://localhost:8787/works/hyperjam");
      expect(await response.json()).toEqual({ id: "work-1" });
    });
  });

  describe("categories", () => {
    it("forwards category creates", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(sessionBody))
        .mockResolvedValueOnce(jsonResponse({ id: "cat-2" }));
      const created = await app.fetch(
        writeRequest("http://localhost/content/categories", "POST", { slug: "notes" }),
      );
      expect(created.status).toBe(200);
      expect(writeCall().url).toBe("http://localhost:8787/categories");
    });

    it("forwards category deletes", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(sessionBody))
        .mockResolvedValueOnce(jsonResponse({ id: "cat-2" }));
      const deleted = await app.fetch(
        writeRequest("http://localhost/content/categories/notes", "DELETE"),
      );
      expect(deleted.status).toBe(200);
      expect(writeCall().url).toBe("http://localhost:8787/categories/notes");
    });
  });

  describe("POST /content/media", () => {
    it("forwards multipart uploads byte-for-byte", async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(sessionBody))
        .mockResolvedValueOnce(jsonResponse({ id: "media-1" }));
      const form = new FormData();
      form.append("file", new File(["bytes"], "a.png", { type: "image/png" }));
      const response = await app.fetch(
        requestWithEnv("http://localhost/content/media", env, {
          method: "POST",
          headers: { cookie: "better-auth.session_token=abc" },
          body: form,
        }),
      );
      expect(response.status).toBe(200);
      expect(writeCall().url).toBe("http://localhost:8787/media");
      expect(headerOf(writeCall().init, "content-type")).toContain("multipart/form-data");
      const forwarded = writeCall().init.body as ArrayBuffer;
      expect(forwarded.byteLength).toBeGreaterThan(0);
      expect(new TextDecoder().decode(forwarded)).toContain("a.png");
    });
  });

  describe("GET /content/media/:id/file", () => {
    it("streams upstream bytes without a session check", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response("file-bytes", { headers: { "Content-Type": "image/png" } }),
      );
      const response = await app.fetch(
        requestWithEnv("http://localhost/content/media/m1/file", env),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/png");
      expect(await response.text()).toBe("file-bytes");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://localhost:8787/media/m1/file");
    });
  });
});

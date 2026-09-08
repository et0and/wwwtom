import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const env = testEnv({ API_URL: "http://localhost:8787", INTERNAL_API_TOKEN: "test-token" });

describe("auth integration", () => {
  describe("ALL /auth/*", () => {
    it("forwards method, headers and body with the internal token", async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const response = await app.fetch(
        requestWithEnv("http://localhost/auth/session", env, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: "a=b" },
          body: JSON.stringify({ hello: "world" }),
        }),
      );
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8787/auth/session",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ hello: "world" }),
        }),
      );
      const [, init] = fetchMock.mock.calls[0] as [string, { headers: Headers }];
      expect(init.headers.get("cookie")).toBe("a=b");
      expect(init.headers.get(INTERNAL_TOKEN_HEADER)).toBe("test-token");
      expect(await response.json()).toEqual({ status: "ok" });
    });

    it("passes redirects and cookies through verbatim", async () => {
      fetchMock.mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: {
            location: "https://github.com/login/oauth/authorize?client_id=x",
            "set-cookie": "better-auth.state=abc; Path=/; HttpOnly",
          },
        }),
      );
      const response = await app.fetch(
        requestWithEnv("http://localhost/auth/callback/github", env),
      );
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(
        "https://github.com/login/oauth/authorize?client_id=x",
      );
      expect(response.headers.get("set-cookie")).toContain("better-auth.state=abc");
    });

    it("returns 502 when the API is unreachable", async () => {
      fetchMock.mockRejectedValue(new Error("connection refused"));
      const response = await app.fetch(requestWithEnv("http://localhost/auth/session", env));
      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({
        type: "about:blank",
        status: 502,
        title: "CMS auth unavailable",
        instance: "http://localhost/auth/session",
      });
    });

    it("forwards query params to API", async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const response = await app.fetch(
        requestWithEnv("http://localhost/auth/session?foo=bar&n=1", env),
      );
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8787/auth/session?foo=bar&n=1",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("forwards PUT body with internal token", async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const response = await app.fetch(
        requestWithEnv("http://localhost/auth/user", env, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Tom" }),
        }),
      );
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8787/auth/user",
        expect.objectContaining({ method: "PUT", body: JSON.stringify({ name: "Tom" }) }),
      );
      const [, init] = fetchMock.mock.calls[0] as [string, { headers: Headers }];
      expect(init.headers.get(INTERNAL_TOKEN_HEADER)).toBe("test-token");
    });

    it("hides internal token from client responses", async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const response = await app.fetch(requestWithEnv("http://localhost/auth/session", env));
      expect(response.status).toBe(200);
      expect(response.headers.get(INTERNAL_TOKEN_HEADER)).toBeNull();
    });
  });

  describe("auth hardening", () => {
    const signIn = (
      requestEnv: typeof env,
      origin: string,
      body: Record<string, string>,
    ): ReturnType<typeof app.fetch> =>
      app.fetch(
        requestWithEnv("http://localhost/auth/sign-in/social", requestEnv, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: origin },
          body: JSON.stringify(body),
        }),
      );

    it("rejects an evil callbackURL without proxying", async () => {
      const response = await signIn(env, "https://cms.tom.so", {
        provider: "github",
        callbackURL: "https://evil.com",
      });
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        type: "https://errors.tom.so/forbidden",
        status: 403,
        title: "Untrusted auth callback",
        instance: "http://localhost/auth/sign-in/social",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects cross-tenant callbackURLs on the Sophie worker", async () => {
      const sophieEnv = testEnv({
        API_URL: "http://localhost:8789",
        INTERNAL_API_TOKEN: "test-token",
        TENANT: "sophie",
      });
      const response = await signIn(sophieEnv, "https://cms.sophie.st", {
        provider: "google",
        callbackURL: "https://cms.tom.so",
      });
      expect(response.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("proxies same-tenant sign-ins with a trusted callbackURL", async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ url: "https://accounts.google.com/x", redirect: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const sophieEnv = testEnv({
        API_URL: "http://localhost:8789",
        INTERNAL_API_TOKEN: "test-token",
        TENANT: "sophie",
      });
      const response = await signIn(sophieEnv, "https://cms.sophie.st", {
        provider: "google",
        callbackURL: "https://cms.sophie.st",
      });
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8789/auth/sign-in/social",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("rejects non-GET auth requests from untrusted origins", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/auth/sign-out", env, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: "https://evil.com" },
          body: "{}",
        }),
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        type: "https://errors.tom.so/forbidden",
        status: 403,
        title: "Untrusted auth origin",
        instance: "http://localhost/auth/sign-out",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("leaves GET callbacks (OAuth redirect flow) untouched", async () => {
      fetchMock.mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { location: "https://cms.tom.so" },
        }),
      );
      const response = await app.fetch(
        requestWithEnv("http://localhost/auth/callback/github?code=x", env),
      );
      expect(response.status).toBe(302);
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:8787/auth/callback/github?code=x",
        expect.objectContaining({ method: "GET" }),
      );
    });
  });
});

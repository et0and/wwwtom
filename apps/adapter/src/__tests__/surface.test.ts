import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";

const env = testEnv();

describe("adapter surface", () => {
  describe("CORS", () => {
    afterEach(() => vi.restoreAllMocks());

    it("allows 127.0.0.1 origin (e2e)", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/payload/posts", env, {
          method: "OPTIONS",
          headers: { Origin: "http://127.0.0.1:3000", "Access-Control-Request-Method": "GET" },
        }),
      );
      expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:3000");
    });

    it("allows tom.so subdomains via endsWith", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/payload/posts", env, {
          method: "OPTIONS",
          headers: { Origin: "https://staging.tom.so", "Access-Control-Request-Method": "GET" },
        }),
      );
      expect(response.headers.get("access-control-allow-origin")).toBe("https://staging.tom.so");
    });
  });

  describe("visitor session", () => {
    it("creates a visitor session cookie when none exists", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/payload/posts?pageSize=1", env),
      );
      const setCookie = response.headers.getSetCookie().join(";");
      expect(setCookie).toContain("tom_session=");
    });

    it("reuses visitor session when cookie present", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/payload/posts?pageSize=1", env, {
          headers: { Cookie: "tom_session=visitor-123" },
        }),
      );
      expect(response.status).toBe(200);
      // Should not set a new cookie when one already exists
      const setCookies = response.headers.getSetCookie();
      const tomSessionSet = setCookies.find((c) => c.startsWith("tom_session="));
      expect(tomSessionSet).toBeUndefined();
    });

    it("sets secure flag in production", async () => {
      const prodEnv = testEnv({ NODE_ENV: "production" });
      const response = await app.fetch(
        requestWithEnv("http://localhost/payload/posts?pageSize=1", prodEnv),
      );
      const setCookie = response.headers.getSetCookie().find((c) => c.startsWith("tom_session="));
      expect(setCookie).toContain("Secure");
    });

    it("does not set secure flag outside production", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/payload/posts?pageSize=1", env),
      );
      const setCookie = response.headers.getSetCookie().find((c) => c.startsWith("tom_session="));
      expect(setCookie).not.toContain("Secure");
    });
  });

  describe("request id", () => {
    it("sets x-request-id header", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/payload/posts?pageSize=1", env),
      );
      expect(response.headers.get("x-request-id")).toBeTruthy();
    });
  });

  describe("guestbook session bridging", () => {
    it("bridges guestbook_session cookie to sessionId", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/payload/posts?pageSize=1", env, {
          headers: { Cookie: "guestbook_session=sess-123" },
        }),
      );
      expect(response.status).toBe(200);
    });
  });

  describe("onError", () => {
    it("returns 404 JSON for unknown routes with AdapterError mapping", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/unknown-surface-route", env),
      );
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("application/json");
    });

    it("handles invalid pagination query without crashing", async () => {
      const response = await app.fetch(
        requestWithEnv(
          "http://localhost/payload/posts?page=not-a-number&pageSize=not-a-number",
          env,
        ),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");
    });
  });
});

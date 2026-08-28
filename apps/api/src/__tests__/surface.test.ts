import { describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";

const env = testEnv();

describe("api surface", () => {
  describe("request id", () => {
    it("sets x-request-id on every response", async () => {
      const response = await app.fetch(requestWithEnv("http://localhost/health", env));
      expect(response.headers.get("x-request-id")).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("sets unique request ids per request", async () => {
      const r1 = await app.fetch(requestWithEnv("http://localhost/health", env));
      const r2 = await app.fetch(requestWithEnv("http://localhost/health", env));
      expect(r1.headers.get("x-request-id")).not.toBe(r2.headers.get("x-request-id"));
    });
  });

  describe("content-type", () => {
    it("sets application/json on error responses", async () => {
      const notFound = await app.fetch(requestWithEnv("http://localhost/unknown-surface", env));
      expect(notFound.headers.get("content-type")).toContain("application/json");
      expect(notFound.status).toBe(404);
    });

    it("sets application/json on validation errors", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/checkout?products=", env, {
          headers: { "x-internal-token": "test-internal-token" },
        }),
      );
      expect(response.headers.get("content-type")).toContain("application/json");
    });
  });

  describe("openapi", () => {
    it("serves spec with servers and securitySchemes", async () => {
      const response = await app.fetch(requestWithEnv("http://localhost/openapi.json", env));
      expect(response.status).toBe(200);
      const spec = (await response.json()) as {
        servers: Array<{ url: string }>;
        components: { securitySchemes: Record<string, string> };
      };
      expect(spec.servers.some((s) => s.url === "https://api.tom.so")).toBe(true);
      expect(spec.components.securitySchemes["InternalToken"]).toBeDefined();
    });
  });

  describe("og is public", () => {
    it("does not require internal token for /og", async () => {
      const response = await app.fetch(requestWithEnv("http://localhost/og?title=Hello", env));
      expect([200, 500, 502].includes(response.status)).toBe(true);
      expect(response.status).not.toBe(401);
    });
  });

  describe("onError logging", () => {
    it("handles not found without crashing", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const response = await app.fetch(requestWithEnv("http://localhost/not-a-route-123", env));
      expect(response.status).toBe(404);
      spy.mockRestore();
    });
  });
});

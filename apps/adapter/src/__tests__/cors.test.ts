import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { jsonResponse, payloadPostsResponse, requestWithEnv, testEnv } from "../test/helpers";

const env = testEnv();

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse(payloadPostsResponse));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const preflight = (origin: string) =>
  requestWithEnv("http://localhost/payload/posts", env, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "GET",
    },
  });

describe("adapter CORS", () => {
  it.each([
    "http://localhost:5173",
    "http://localhost:3000",
    "https://tom.so",
    "https://dev-web.tom.so",
    "https://dev-adapter.tom.so",
  ])("allows the %s origin on preflight", async (origin) => {
    const response = await app.fetch(preflight(origin));
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    expect(response.headers.get("access-control-allow-methods")).toBe("GET, POST, OPTIONS");
    expect(response.headers.get("access-control-allow-headers")).toBe(
      "Content-Type, x-use-simulator",
    );
  });

  it.each(["https://evil.example.com", "https://tom.so.attacker.io"])(
    "does not allow the %s origin",
    async (origin) => {
      const response = await app.fetch(preflight(origin));
      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    },
  );

  it("echoes the allowed origin on actual requests", async () => {
    const response = await app.fetch(
      requestWithEnv("http://localhost/payload/posts?pageSize=1", env, {
        headers: { Origin: "https://dev-web.tom.so" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://dev-web.tom.so");
  }, 10_000);

  it("does not set CORS headers for server-to-server requests without an Origin", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/payload/posts", env));
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { allowLocalOriginsForAdapter } from "../origins";
import { jsonResponse, requestWithEnv, testEnv } from "../test/helpers";

const env = testEnv({ ADAPTER_URL: "http://localhost:8788" });

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(jsonResponse({ docs: [] }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const preflight = (origin: string) =>
  requestWithEnv("http://localhost/content/posts", env, {
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
    "http://localhost:5174",
    "http://localhost:3001",
    "https://tom.so",
    "https://cms.tom.so",
    "https://adapter.tom.so",
    "https://dev-web.tom.so",
    "https://dev-adapter.tom.so",
    "https://pr-42-cms.tom.so",
    "https://sophie.st",
    "https://cms.sophie.st",
    "https://adapter.sophie.st",
    "https://api.sophie.st",
    "https://dev-cms.sophie.st",
  ])("allows the %s origin on preflight", async (origin) => {
    const response = await app.fetch(preflight(origin));
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    expect(response.headers.get("access-control-allow-headers")).toBe(
      "Content-Type, x-use-simulator",
    );
  });

  it("allows editor PUT preflights with credentials", async () => {
    const response = await app.fetch(
      requestWithEnv("http://localhost/content/posts/hello-world", env, {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:5173",
          "Access-Control-Request-Method": "PUT",
        },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it.each(["https://evil.example.com", "https://tom.so.attacker.io", "https://evil.tom.so"])(
    "does not allow the %s origin",
    async (origin) => {
      const response = await app.fetch(preflight(origin));
      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    },
  );

  it.each([
    "https://evil-sophie.st",
    "https://sophie.st.evil.com",
    "https://cms.sophie.st.evil.com",
    "https://pr-138-cms.sophie.st.evil.com",
  ])("does not allow the lookalike %s origin", async (origin) => {
    const response = await app.fetch(preflight(origin));
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("does not allow localhost origins against a deployed worker", async () => {
    const response = await app.fetch(
      requestWithEnv(
        "https://adapter.tom.so/content/posts",
        testEnv({ ADAPTER_URL: "https://adapter.tom.so" }),
        {
          method: "OPTIONS",
          headers: {
            Origin: "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
          },
        },
      ),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("scopes preflights to the worker tenant", async () => {
    const sophiePreflight = (origin: string) =>
      requestWithEnv("http://localhost/content/posts", testEnv({ TENANT: "sophie" }), {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "GET",
        },
      });
    const tomOrigin = await app.fetch(sophiePreflight("https://cms.tom.so"));
    expect(tomOrigin.headers.get("access-control-allow-origin")).toBeNull();
    const sophieOrigin = await app.fetch(sophiePreflight("https://cms.sophie.st"));
    expect(sophieOrigin.headers.get("access-control-allow-origin")).toBe("https://cms.sophie.st");
  });

  it("echoes the allowed origin on actual requests", async () => {
    const response = await app.fetch(
      requestWithEnv("http://localhost/content/posts?pageSize=1", env, {
        headers: { Origin: "https://dev-web.tom.so" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://dev-web.tom.so");
  }, 10_000);

  it("does not set CORS headers for server-to-server requests without an Origin", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/content/posts", env));
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("allowLocalOriginsForAdapter", () => {
  it.each(["http://localhost:8788", "http://127.0.0.1:8790"])(
    "trusts localhost when the worker itself runs on %s",
    (adapterUrl) => {
      expect(allowLocalOriginsForAdapter(adapterUrl)).toBe(true);
    },
  );

  it.each([
    "https://adapter.tom.so",
    "https://dev-adapter.sophie.st",
    "http://adapter.tom.so",
    "not a url",
    "",
  ])("does not trust localhost when the worker runs on %s", (adapterUrl) => {
    expect(allowLocalOriginsForAdapter(adapterUrl)).toBe(false);
  });

  it("does not trust localhost without a worker URL", () => {
    expect(allowLocalOriginsForAdapter(undefined)).toBe(false);
  });
});

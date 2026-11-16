import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";
import type { CloudflareEnv } from "@tom/utils/config";
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

const tomEnv = (overrides: Partial<CloudflareEnv> = {}) =>
  testEnv({
    TENANT: "tom",
    API_URL: "http://localhost:8787",
    INTERNAL_API_TOKEN: "test-internal-token",
    ...overrides,
  });

describe("arena proxy", () => {
  it("calls the api's internal route with the adapter token", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ docs: [] }));

    const response = await app.fetch(
      requestWithEnv("http://localhost/content/arena/posts", tomEnv(), {
        headers: {
          cookie: "better-auth.session_token=abc",
          authorization: "Bearer fixture-token",
        },
      }),
    );

    expect(response.status).toBe(200);
    const [input, init] = fetchMock.mock.calls[0] as [Request, RequestInit];
    const url = new URL(input instanceof Request ? input.url : String(input));
    expect(url.origin + url.pathname).toBe("http://localhost:8787/internal/content/arena/posts");
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    for (const [key, value] of new Headers(init?.headers as HeadersInit)) headers.set(key, value);
    expect(headers.get(INTERNAL_TOKEN_HEADER)).toBe("test-internal-token");
    expect(headers.get("cookie")).toBe("better-auth.session_token=abc");
    expect(headers.get("authorization")).toBe("Bearer fixture-token");
  });

  it("prefers the api service binding over the public URL", async () => {
    const bindingFetch = vi.fn(async () => jsonResponse({ docs: [] }));

    await app.fetch(
      requestWithEnv(
        "http://localhost/content/arena/posts",
        tomEnv({ API: { fetch: bindingFetch } }),
      ),
    );

    expect(bindingFetch).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("routes to the simulator when the request opts in", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ docs: [] }));

    await app.fetch(
      requestWithEnv(
        "http://localhost/content/arena/posts",
        tomEnv({ SIMULATOR_URL: "http://127.0.0.1:8789" }),
        { headers: { "x-use-simulator": "1" } },
      ),
    );

    const [input] = fetchMock.mock.calls[0] as [Request, RequestInit];
    const url = new URL(input instanceof Request ? input.url : String(input));
    expect(url.origin + url.pathname).toBe("http://127.0.0.1:8789/internal/content/arena/posts");
  });

  it("routes the frame image to the simulator when the request opts in", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([0xf8, 0x00]), {
        headers: { "Content-Type": "application/octet-stream" },
      }),
    );

    await app.fetch(
      requestWithEnv(
        "http://localhost/arena/frame/desk/image/12",
        tomEnv({
          SIMULATOR_URL: "http://127.0.0.1:8789",
          API: { fetch: async () => new Response("live") },
        }),
        { headers: { "x-use-simulator": "1" } },
      ),
    );

    const [input] = fetchMock.mock.calls[0] as [Request, RequestInit];
    const url = new URL(input instanceof Request ? input.url : String(input));
    expect(url.origin + url.pathname).toBe(
      "http://127.0.0.1:8789/internal/arena/frame/desk/image/12",
    );
  });

  it("forwards the api cache policy", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ docs: [] }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=3600",
          "CDN-Cache-Control": "public, s-maxage=3600",
        },
      }),
    );

    const response = await app.fetch(
      requestWithEnv("http://localhost/content/arena/posts", tomEnv()),
    );

    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=3600");
    expect(response.headers.get("CDN-Cache-Control")).toBe("public, s-maxage=3600");
  });

  it("streams the frame image through unchanged", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([0xf8, 0x00]), {
        headers: {
          "Content-Type": "application/octet-stream",
          "Cache-Control": "public, max-age=3600, s-maxage=604800",
          "X-Frame-Width": "240",
          "X-Frame-Height": "135",
          "X-Frame-Format": "rgb565be",
        },
      }),
    );

    const response = await app.fetch(
      requestWithEnv("http://localhost/arena/frame/desk/image/12", tomEnv()),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(response.headers.get("X-Frame-Width")).toBe("240");
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([0xf8, 0x00]);
  });
});

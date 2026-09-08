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

describe("og integration", () => {
  it("forwards to the API with the internal token header", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );
    const env = testEnv({
      API_URL: "http://localhost:8787",
      INTERNAL_API_TOKEN: "test-token",
    });

    const response = await app.fetch(requestWithEnv("http://localhost/og?title=Hello", env));

    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("http://localhost:8787/og");
    const headers = new Headers(init.headers);
    expect(headers.get(INTERNAL_TOKEN_HEADER)).toBe("test-token");
  });

  it("keeps commas in title/summary (Elysia splits them into lists)", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );
    const env = testEnv({
      API_URL: "http://localhost:8787",
      INTERNAL_API_TOKEN: "test-token",
    });

    const response = await app.fetch(
      requestWithEnv("http://localhost/og?title=Hi,Tom&summary=Aotearoa,New%20Zealand", env),
    );

    expect(response.status).toBe(200);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    const forwarded = new URL(url);
    expect(forwarded.searchParams.get("title")).toBe("Hi,Tom");
    expect(forwarded.searchParams.get("summary")).toBe("Aotearoa,New Zealand");
  });

  it("forwards the requested template but omits it when absent", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );
    const env = testEnv({
      API_URL: "http://localhost:8787",
      INTERNAL_API_TOKEN: "test-token",
    });

    await app.fetch(requestWithEnv("http://localhost/og?title=Hi&template=sophie", env));
    const [sophieUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(sophieUrl).searchParams.get("template")).toBe("sophie");

    // Absent template must stay absent so the API's Referer-based
    // auto-select survives the hop instead of being forced to "default".
    await app.fetch(requestWithEnv("http://localhost/og?title=Hi", env));
    const [defaultUrl] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(new URL(defaultUrl).searchParams.has("template")).toBe(false);
  });

  it("forwards the Referer header for template auto-select", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );
    const env = testEnv({
      API_URL: "http://localhost:8787",
      INTERNAL_API_TOKEN: "test-token",
    });

    const response = await app.fetch(
      requestWithEnv("http://localhost/og?title=Hi", env, {
        headers: { referer: "https://sophie.st/posts/hi" },
      }),
    );

    expect(response.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("referer")).toBe("https://sophie.st/posts/hi");
  });

  it("forwards the date line when present", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );
    const env = testEnv({
      API_URL: "http://localhost:8787",
      INTERNAL_API_TOKEN: "test-token",
    });

    await app.fetch(requestWithEnv("http://localhost/og?title=Hi&date=January%2029,%202016", env));
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).searchParams.get("date")).toBe("January 29, 2016");
  });
});

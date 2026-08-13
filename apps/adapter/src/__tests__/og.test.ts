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
});

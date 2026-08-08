import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("adapter error handling", () => {
  it("returns 404 JSON for unknown routes", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/nope", testEnv()));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });

  it("forwards an unparseable page param and falls back to the empty page", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          docs: [],
          totalDocs: 0,
          limit: 5,
          page: 1,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        }),
        { status: 200 },
      ),
    );
    const response = await app.fetch(
      requestWithEnv("http://localhost/payload/posts?page=not-a-number", testEnv()),
    );
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://cms.tom.so/api/posts?sort=-publishedAt&limit=5&page=NaN&depth=1",
      expect.anything(),
    );
  });

  it("returns 500 JSON when an integration has no access token configured", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/polar/products", testEnv()));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Network error");
  });
});

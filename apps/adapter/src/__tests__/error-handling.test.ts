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
  it("returns RFC 9457 problem details for unknown routes", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/nope", testEnv()));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      type: "https://errors.tom.so/not-found",
      status: 404,
      title: "Not found",
      instance: "http://localhost/nope",
    });
  });

  it("surfaces the API validation failure for an unparseable page param", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "https://errors.tom.so/validation",
          status: 400,
          title: "Invalid paging parameters",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    );
    const response = await app.fetch(
      requestWithEnv("http://localhost/content/posts?page=not-a-number", testEnv()),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      type: "https://errors.tom.so/validation",
      status: 400,
      title: "CMS posts request failed",
      instance: "http://localhost/content/posts?page=not-a-number",
    });
  });

  it("returns 500 problem details when an integration has no access token configured", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/polar/products", testEnv()));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      type: "about:blank",
      status: 500,
      title: "Network error",
      instance: "http://localhost/polar/products",
    });
  });
});

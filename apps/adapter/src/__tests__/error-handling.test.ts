import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../index";
import { fetchMock, requestWithEnv, stubFetch, testEnv, unstubFetch } from "../test/helpers";

beforeEach(stubFetch);

afterEach(unstubFetch);

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

  it("rejects an unparseable page param before calling the API", async () => {
    const response = await app.fetch(
      requestWithEnv("http://localhost/content/posts?page=not-a-number", testEnv()),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      type: "https://errors.tom.so/validation",
      status: 400,
      title: "Validation error",
      instance: "http://localhost/content/posts?page=not-a-number",
      errors: [{ detail: "Expected a finite number", pointer: "#/page" }],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces an API validation failure for a page the API rejects", async () => {
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
      requestWithEnv("http://localhost/content/posts?page=0", testEnv()),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      type: "https://errors.tom.so/validation",
      status: 400,
      title: "CMS posts request failed",
      instance: "http://localhost/content/posts?page=0",
    });
  });

  it("returns 502 problem details when an integration has no access token configured", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/polar/products", testEnv()));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toEqual({
      type: "about:blank",
      status: 502,
      title: "Network error",
      instance: "http://localhost/polar/products",
    });
  });
});

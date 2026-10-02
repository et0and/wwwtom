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

  it("rejects an out-of-range page param before calling the API", async () => {
    // The bounds live in the shared CmsPagingSchema, so the adapter rejects
    // page=0 at its own boundary instead of forwarding a request the API would
    // only reject anyway.
    const response = await app.fetch(
      requestWithEnv("http://localhost/content/posts?page=0", testEnv()),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      type: "https://errors.tom.so/validation",
      status: 400,
      title: "Validation error",
      instance: "http://localhost/content/posts?page=0",
      errors: [{ detail: "Expected a value greater than or equal to 1", pointer: "#/page" }],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards an upstream problem status from the API", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 409, title: "Post slug taken" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const response = await app.fetch(
      requestWithEnv("http://localhost/content/posts?page=1", testEnv()),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      type: "https://errors.tom.so/conflict",
      status: 409,
      title: "CMS posts request failed",
      instance: "http://localhost/content/posts?page=1",
    });
  });
});

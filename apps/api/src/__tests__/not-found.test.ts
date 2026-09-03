import { describe, expect, it } from "vitest";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";

describe("api error handling", () => {
  it("returns RFC 9457 problem details for unknown routes", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/nope", testEnv()));
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    expect(await response.json()).toEqual({
      type: "https://errors.tom.so/not-found",
      status: 404,
      title: "Not found",
      instance: "http://localhost/nope",
    });
  });
});

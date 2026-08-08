import { describe, expect, it } from "vitest";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";

describe("api error handling", () => {
  it("returns 404 JSON for unknown routes", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/nope", testEnv()));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });
});

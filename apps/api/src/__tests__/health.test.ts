import { describe, expect, it } from "vitest";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";

describe("health endpoint", () => {
  it("returns a healthy status with a timestamp", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/health", testEnv()));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ status: "healthy" });
    expect(typeof body.timestamp).toBe("number");
  });

  it("sets a request id header on every response", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/health", testEnv()));
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });
});

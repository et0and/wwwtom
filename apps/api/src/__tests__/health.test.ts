import { describe, expect, it } from "vitest";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";

describe("health endpoint", () => {
  it("returns a healthy status with a timestamp", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/health", testEnv()));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ status: "healthy" });
    expect(body.timestamp).toBeTypeOf("number");
  });

  it("sets a request id header on every response", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/health", testEnv()));
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("tenant route composition", () => {
  it("keeps the health route for both tenants", async () => {
    for (const tenant of ["tom", "sophie"]) {
      const response = await app.fetch(
        requestWithEnv("http://localhost/health", testEnv({ TENANT: tenant })),
      );
      expect(response.status).toBe(200);
    }
  });

  it("does not expose CMS reads or writes to the Tom tenant", async () => {
    const read = await app.fetch(
      requestWithEnv("http://localhost/posts", testEnv({ TENANT: "tom" })),
    );
    expect(read.status).toBe(404);

    const write = await app.fetch(
      requestWithEnv("http://localhost/posts", testEnv({ TENANT: "tom" }), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [INTERNAL_TOKEN_HEADER]: "test-internal-token",
        },
        body: JSON.stringify({}),
      }),
    );
    expect(write.status).toBe(404);
  });

  it("routes CMS reads to the CMS stack for the Sophie tenant", async () => {
    // No CMS_D1 binding: the route is present and fails closed with a 500,
    // which proves dispatch reaches the CMS rather than the tenant guard.
    const response = await app.fetch(
      requestWithEnv("http://localhost/posts", testEnv({ TENANT: "sophie" })),
    );
    expect(response.status).toBe(500);
  });
});

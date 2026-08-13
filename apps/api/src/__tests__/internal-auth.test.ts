import { describe, expect, it } from "vitest";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";

describe("internal token auth", () => {
  it("rejects /checkout without the token", async () => {
    const response = await app.fetch(
      requestWithEnv("http://localhost/checkout?products=prod_1", testEnv()),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("rejects /checkout with a wrong token", async () => {
    const response = await app.fetch(
      requestWithEnv("http://localhost/checkout?products=prod_1", testEnv(), {
        headers: { [INTERNAL_TOKEN_HEADER]: "wrong-token" },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("protects /og and /portal too", async () => {
    const og = await app.fetch(requestWithEnv("http://localhost/og", testEnv()));
    const portal = await app.fetch(
      requestWithEnv("http://localhost/portal?customerId=cust_1", testEnv()),
    );
    expect(og.status).toBe(401);
    expect(portal.status).toBe(401);
  });

  it("leaves /health public", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/health", testEnv()));
    expect(response.status).toBe(200);
  });
});

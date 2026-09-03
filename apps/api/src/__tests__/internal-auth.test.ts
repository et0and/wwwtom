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
    expect(await response.json()).toEqual({
      type: "https://errors.tom.so/unauthorized",
      status: 401,
      title: "Unauthorized",
    });
  });

  it("rejects /checkout with a wrong token", async () => {
    const response = await app.fetch(
      requestWithEnv("http://localhost/checkout?products=prod_1", testEnv(), {
        headers: { [INTERNAL_TOKEN_HEADER]: "wrong-token" },
      }),
    );
    expect(response.status).toBe(401);
    expect((await response.json()).type).toBe("https://errors.tom.so/unauthorized");
  });

  it("leaves /og public for social crawlers", async () => {
    // The OG image route must be reachable without the token — Twitter,
    // Slack and iMessage fetch og:image URLs with no auth headers. (The
    // route then generates or 502s on font fetch, but never 401s.)
    const og = await app.fetch(requestWithEnv("http://localhost/og", testEnv()));
    expect(og.status).not.toBe(401);
  });

  it("protects /portal", async () => {
    const portal = await app.fetch(
      requestWithEnv("http://localhost/portal?customerId=cust_1", testEnv()),
    );
    expect(portal.status).toBe(401);
  });

  it("leaves /health public", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/health", testEnv()));
    expect(response.status).toBe(200);
  });
});

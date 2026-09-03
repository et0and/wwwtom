import { describe, expect, it } from "vitest";
import { dashboardLinks, toProblemResponse } from "../src/services/worker";

describe("toProblemResponse", () => {
  it("keeps a valid error status and defaults the type to about:blank", async () => {
    const response = toProblemResponse(502, "upstream down");
    expect(response.status).toBe(502);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    expect(await response.json()).toEqual({
      type: "about:blank",
      status: 502,
      title: "upstream down",
    });
  });

  it("carries problem details, instance, and validation errors", async () => {
    const response = toProblemResponse(400, "Validation error", {
      type: "https://errors.tom.so/validation",
      detail: "title - too long",
      instance: "http://localhost/og",
      errors: [{ pointer: "#/title", detail: "too long" }],
    });
    expect(await response.json()).toEqual({
      type: "https://errors.tom.so/validation",
      status: 400,
      title: "Validation error",
      detail: "title - too long",
      instance: "http://localhost/og",
      errors: [{ pointer: "#/title", detail: "too long" }],
    });
  });

  it("falls back to 500 for a 0 sentinel", () => {
    expect(toProblemResponse(0, "boom").status).toBe(500);
  });

  it("falls back to 500 for a redirect-class status", () => {
    expect(toProblemResponse(302, "boom").status).toBe(500);
  });

  it("falls back to 500 for a non-error status", () => {
    expect(toProblemResponse(200, "boom").status).toBe(500);
  });
});

describe("dashboardLinks", () => {
  it("links Axiom logs and the Cloudflare workers dashboard", () => {
    expect(dashboardLinks()).toEqual([
      { text: "Axiom logs", url: "https://app.axiom.co/yufugumi-tchp/query" },
      {
        text: "Cloudflare Workers",
        url: "https://dash.cloudflare.com/?to=/:account/workers-and-pages",
      },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { toErrorResponse } from "../src/services/worker";

describe("toErrorResponse", () => {
  it("keeps a valid error status", async () => {
    const response = toErrorResponse(502, "upstream down");
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "upstream down" });
  });

  it("falls back to 500 for a 0 sentinel", () => {
    expect(toErrorResponse(0, "boom").status).toBe(500);
  });

  it("falls back to 500 for a redirect-class status", () => {
    expect(toErrorResponse(302, "boom").status).toBe(500);
  });

  it("falls back to 500 for a non-error status", () => {
    expect(toErrorResponse(200, "boom").status).toBe(500);
  });
});

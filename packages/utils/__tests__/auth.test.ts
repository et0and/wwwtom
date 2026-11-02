import { describe, expect, it } from "vitest";
import { timingSafeEqual } from "../src/auth";

describe("timingSafeEqual", () => {
  it("matches identical values", () => {
    expect(timingSafeEqual("device-token", "device-token")).toBe(true);
  });

  it("rejects different values of the same length", () => {
    expect(timingSafeEqual("device-token", "device-tokeN")).toBe(false);
  });

  it("rejects different lengths", () => {
    expect(timingSafeEqual("device-token", "device-token-longer")).toBe(false);
  });
});

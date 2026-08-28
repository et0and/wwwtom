import { describe, expect, it } from "vitest";
import { timingSafeEqual } from "../internal";

describe("timingSafeEqual", () => {
  it("returns true for equal strings", () => {
    expect(timingSafeEqual("secret", "secret")).toBe(true);
    expect(timingSafeEqual("", "")).toBe(true);
    expect(timingSafeEqual("a", "a")).toBe(true);
  });

  it("returns false for different lengths", () => {
    expect(timingSafeEqual("short", "longer")).toBe(false);
    expect(timingSafeEqual("", "a")).toBe(false);
    expect(timingSafeEqual("abc", "ab")).toBe(false);
  });

  it("returns false for same length but different content", () => {
    expect(timingSafeEqual("secret", "secreu")).toBe(false);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("a", "b")).toBe(false);
  });

  it("is constant-time for same-length mismatch at different positions", () => {
    expect(timingSafeEqual("abcde", "abXde")).toBe(false);
    expect(timingSafeEqual("abcde", "Xbcde")).toBe(false);
    expect(timingSafeEqual("abcde", "abcdX")).toBe(false);
  });
});

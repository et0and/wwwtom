import { describe, expect, it } from "vitest";
import { toSlug } from "../src/slug";

describe("toSlug", () => {
  it("lowercases and dashes non-alphanumerics", () => {
    expect(toSlug("Hello World")).toBe("hello-world");
  });

  it("folds diacritics", () => {
    expect(toSlug("Pōneke")).toBe("poneke");
    expect(toSlug("Café Society")).toBe("cafe-society");
  });

  it("collapses runs and trims the ends", () => {
    expect(toSlug("  --Hello___World!!  ")).toBe("hello-world");
  });

  it("returns empty for a title with nothing sluggable", () => {
    expect(toSlug("🎉🎉")).toBe("");
  });
});

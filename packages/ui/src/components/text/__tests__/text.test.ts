import { describe, expect, it } from "vitest";
import {
  BOLDABLE_VARIANTS,
  DEFAULT_ELEMENT_BY_VARIANT,
  TOMUI_TEXT_VARIANTS,
  type TomuiTextSize,
  type TomuiTextVariant,
  resolveTextSizeClasses,
} from "../variants";

const VARIANTS: ReadonlyArray<TomuiTextVariant> = [
  "heading",
  "body",
  "secondary",
  "success",
  "error",
  "mono",
  "mono-secondary",
];

const SIZES: ReadonlyArray<TomuiTextSize> = ["xs", "sm", "base", "lg"];

describe("Text variants", () => {
  it("exposes exactly the seven live variants", () => {
    expect(Object.keys(TOMUI_TEXT_VARIANTS.variant).sort()).toEqual([...VARIANTS].sort());
  });

  it("has no deprecated heading variants left", () => {
    const names = Object.keys(TOMUI_TEXT_VARIANTS.variant);
    expect(names).not.toContain("heading1");
    expect(names).not.toContain("heading2");
    expect(names).not.toContain("heading3");
    expect(Object.keys(DEFAULT_ELEMENT_BY_VARIANT)).toHaveLength(names.length);
  });

  it("carries a description and classes for every variant", () => {
    for (const variant of VARIANTS) {
      expect(TOMUI_TEXT_VARIANTS.variant[variant].classes.length).toBeGreaterThan(0);
      expect(TOMUI_TEXT_VARIANTS.variant[variant].description.length).toBeGreaterThan(0);
    }
  });
});

describe("DEFAULT_ELEMENT_BY_VARIANT", () => {
  it("renders headings and monospace as span, body variants as p", () => {
    expect(DEFAULT_ELEMENT_BY_VARIANT.heading).toBe("span");
    expect(DEFAULT_ELEMENT_BY_VARIANT.mono).toBe("span");
    expect(DEFAULT_ELEMENT_BY_VARIANT["mono-secondary"]).toBe("span");
    expect(DEFAULT_ELEMENT_BY_VARIANT.body).toBe("p");
    expect(DEFAULT_ELEMENT_BY_VARIANT.secondary).toBe("p");
    expect(DEFAULT_ELEMENT_BY_VARIANT.success).toBe("p");
    expect(DEFAULT_ELEMENT_BY_VARIANT.error).toBe("p");
  });

  it("covers every variant", () => {
    expect(Object.keys(DEFAULT_ELEMENT_BY_VARIANT).sort()).toEqual([...VARIANTS].sort());
  });
});

describe("BOLDABLE_VARIANTS", () => {
  it("is exactly the body variants", () => {
    expect([...BOLDABLE_VARIANTS].sort()).toEqual(["body", "error", "secondary", "success"]);
  });
});

describe("resolveTextSizeClasses", () => {
  it("gives headings 20px only at size lg", () => {
    expect(resolveTextSizeClasses("heading", "lg")).toBe("text-xl");
    for (const size of SIZES.filter((s) => s !== "lg")) {
      expect(resolveTextSizeClasses("heading", size)).toBe("");
    }
  });

  it("keeps monospace one step smaller than body", () => {
    expect(resolveTextSizeClasses("mono", "lg")).toBe("text-base/[inherit]");
    expect(resolveTextSizeClasses("mono", "sm")).toBe("text-sm/[inherit]");
    expect(resolveTextSizeClasses("mono-secondary", "lg")).toBe("text-base/[inherit]");
  });

  it("passes the requested size through for body variants", () => {
    for (const variant of ["body", "secondary", "success", "error"] as const) {
      for (const size of SIZES) {
        expect(resolveTextSizeClasses(variant, size)).toBe(TOMUI_TEXT_VARIANTS.size[size].classes);
      }
    }
  });
});

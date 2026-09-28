import { describe, expect, it } from "vitest";
import { parseHex, parseOklch, parseVarFallback, resolveColorValue, type Rgba } from "../color";

const lookupNone = (): string | undefined => undefined;

describe("parseHex", () => {
  it("expands short hex", () => {
    expect(parseHex("#fff")).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it("reads eight digit hex alpha", () => {
    const parsed = parseHex("#00000080");
    expect(parsed?.a).toBeCloseTo(0.502, 2);
  });

  it("rejects non-hex input", () => {
    expect(parseHex("oklch(0.5 0 0)")).toBeNull();
  });
});

describe("parseOklch", () => {
  it("maps the black corner", () => {
    expect(parseOklch("0 0 0")).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it("maps the white corner", () => {
    const parsed = parseOklch("100% 0 0");
    expect(parsed?.r).toBeCloseTo(1, 6);
    expect(parsed?.g).toBeCloseTo(1, 6);
    expect(parsed?.b).toBeCloseTo(1, 6);
    expect(parsed?.a).toBe(1);
  });

  it("reads slash alpha", () => {
    const parsed = parseOklch("50% 0.1 260 / 0.4");
    expect(parsed?.a).toBeCloseTo(0.4, 5);
  });
});

describe("resolveColorValue", () => {
  it("uses the var fallback when the variable is missing", () => {
    expect(resolveColorValue("var(--missing, #fff)", lookupNone)).toEqual({
      r: 1,
      g: 1,
      b: 1,
      a: 1,
    });
  });

  it("follows a var chain through the lookup", () => {
    const lookup = (name: string): string | undefined => (name === "--brand" ? "#000" : undefined);
    expect(resolveColorValue("var(--brand, #fff)", lookup)).toEqual({
      r: 0,
      g: 0,
      b: 0,
      a: 1,
    });
  });

  it("mixes toward black in oklch", () => {
    const base = resolveColorValue("oklch(60% 0.2 260)", lookupNone) as Rgba;
    const mixed = resolveColorValue(
      "color-mix(in oklch, oklch(60% 0.2 260), black 10%)",
      lookupNone,
    ) as Rgba;
    expect(mixed.r).toBeLessThan(base.r);
    expect(mixed.g).toBeLessThan(base.g);
    expect(mixed.b).toBeLessThan(base.b);
  });

  it("returns transparent for the keyword", () => {
    expect(resolveColorValue("transparent", lookupNone)).toEqual({
      r: 0,
      g: 0,
      b: 0,
      a: 0,
    });
  });
});

describe("parseVarFallback", () => {
  it("extracts a fallback", () => {
    expect(parseVarFallback("var(--a, #abc)")).toBe("#abc");
  });

  it("returns null without a fallback", () => {
    expect(parseVarFallback("var(--a)")).toBeNull();
  });
});

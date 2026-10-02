import { describe, expect, it } from "vitest";
import { customProperties, customPropertyName } from "../stylex-vars";

describe("customPropertyName", () => {
  it("unwraps a defineVars value to its property name", () => {
    expect(customPropertyName("var(--x1xeme93)")).toBe("--x1xeme93");
    expect(customPropertyName("var(--x1b30m3p)")).toBe("--x1b30m3p");
  });

  it("throws on anything that is not a defineVars value", () => {
    // A raw CSS value has no property name to unwrap.
    expect(() => customPropertyName("red")).toThrow(/var\(--x123\)/);
    expect(() => customPropertyName("--not-a-var")).toThrow();
    expect(() => customPropertyName("")).toThrow();
  });

  it("does not accept a multi-value var fallback", () => {
    expect(() => customPropertyName("var(--a, var(--b))")).toThrow();
  });
});

describe("customProperties", () => {
  it("rewrites every key to its property name", () => {
    expect(customProperties({ "var(--x1)": "red", "var(--x2)": "0px" })).toEqual({
      "--x1": "red",
      "--x2": "0px",
    });
  });

  it("returns an empty object for no vars", () => {
    expect(customProperties({})).toEqual({});
  });

  it("propagates the throw for an invalid key", () => {
    expect(() => customProperties({ red: "blue" })).toThrow();
  });
});

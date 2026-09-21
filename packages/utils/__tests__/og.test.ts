import { describe, expect, it } from "vitest";
import { Option, Schema } from "effect";
import { commaTolerantString, joinCommaList } from "@tom/schemas/og";

describe("commaTolerantString", () => {
  it("accepts a short string", () => {
    const parsed = Schema.decodeOption(commaTolerantString(5))("hi");
    expect(Option.isSome(parsed)).toBe(true);
  });

  it("rejects an overlong string", () => {
    const parsed = Schema.decodeOption(commaTolerantString(5))("too long value");
    expect(Option.isNone(parsed)).toBe(true);
  });

  it("accepts the comma-split array form", () => {
    const parsed = Schema.decodeOption(commaTolerantString(100))(["a", "b"]);
    expect(Option.isSome(parsed)).toBe(true);
  });
});

describe("joinCommaList", () => {
  it("passes strings through", () => {
    expect(joinCommaList("hello")).toBe("hello");
  });

  it("rejoins arrays with commas", () => {
    expect(joinCommaList(["a", "b"])).toBe("a,b");
  });

  it("returns undefined for undefined", () => {
    expect(joinCommaList(undefined)).toBeUndefined();
  });
});

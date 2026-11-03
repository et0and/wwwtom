import { describe, expect, it } from "vitest";
import { parsePageNumber } from "../src/page";

describe("parsePageNumber", () => {
  it("accepts positive integers and numeric strings", () => {
    expect(parsePageNumber(1)).toBe(1);
    expect(parsePageNumber(42)).toBe(42);
    expect(parsePageNumber("3")).toBe(3);
  });

  it("defaults to the first page for missing or invalid values", () => {
    const invalidValues: ReadonlyArray<unknown> = [
      undefined,
      null,
      "",
      " ",
      "abc",
      "1.5",
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      true,
      {},
    ];

    for (const value of invalidValues) {
      expect(parsePageNumber(value)).toBe(1);
    }
  });
});

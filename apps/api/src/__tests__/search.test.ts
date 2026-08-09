import { describe, expect, it } from "vitest";
import { buildMatch, levenshtein, normalizeText, tokenize } from "../services/address/search";

describe("search helpers", () => {
  it("normalizes text like the FTS index", () => {
    expect(normalizeText("  Lambton  Quay, Te Aro ")).toBe("lambton quay te aro");
    expect(normalizeText("123 Quay St.")).toBe("123 quay st");
    expect(normalizeText("Tāmaki Makaurau")).toBe("tamaki makaurau");
    expect(normalizeText("")).toBe("");
  });

  it("tokenizes queries", () => {
    expect(tokenize("lambton quay")).toEqual(["lambton", "quay"]);
    expect(tokenize("  123 quay st  ")).toEqual(["123", "quay", "st"]);
    expect(tokenize("")).toEqual([]);
  });

  it("builds FTS match clauses with prefix terms", () => {
    expect(buildMatch([["lambton"], ["quay"]])).toBe("lambton* AND quay*");
    expect(buildMatch([["st", "street", "saint"], ["123"]])).toBe(
      "(st* OR street* OR saint*) AND 123*",
    );
    expect(buildMatch([["a", "a"], []])).toBe("a*");
    expect(buildMatch([[], []])).toBeNull();
  });

  it("computes levenshtein distances", () => {
    expect(levenshtein("kitten", "kitten")).toBe(0);
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("wlg", "wellington")).toBe(7);
    expect(levenshtein("", "abc")).toBe(3);
  });
});

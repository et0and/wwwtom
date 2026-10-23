import { describe, expect, it } from "vitest";
import { normalizeOptionalSecret } from "@tom/schemas/secrets";

describe("normalizeOptionalSecret", () => {
  it("returns undefined for missing input", () => {
    expect(normalizeOptionalSecret(undefined)).toBeUndefined();
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeOptionalSecret("  token  ")).toBe("token");
  });

  it("returns undefined for empty or blank input", () => {
    expect(normalizeOptionalSecret("")).toBeUndefined();
    expect(normalizeOptionalSecret("   ")).toBeUndefined();
  });

  it("returns undefined for undefined/null placeholders", () => {
    expect(normalizeOptionalSecret("undefined")).toBeUndefined();
    expect(normalizeOptionalSecret("NULL")).toBeUndefined();
    expect(normalizeOptionalSecret("  Null  ")).toBeUndefined();
  });
});

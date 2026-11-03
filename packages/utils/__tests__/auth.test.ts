import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import {
  isAdminEmail,
  NormalizedEntry,
  parseAdminEmails,
  timingSafeEqual,
  toAdminEmailSet,
} from "../src/auth";

describe("NormalizedEntry", () => {
  it("trims and lowercases on decode", () => {
    expect(Schema.decodeSync(NormalizedEntry)("  Tom@Example.COM ")).toBe("tom@example.com");
  });

  it("trims on encode without changing case", () => {
    expect(Schema.encodeSync(NormalizedEntry)("  Tom@Example.COM ")).toBe("Tom@Example.COM");
  });
});

describe("toAdminEmailSet", () => {
  it("normalizes entries, deduplicates them and drops blanks", () => {
    expect(
      toAdminEmailSet([" Tom@Example.com ", "tom@example.com", "other@example.com", "", "   "]),
    ).toEqual(new Set(["tom@example.com", "other@example.com"]));
  });
});

describe("parseAdminEmails", () => {
  it("parses a comma-separated allowlist", () => {
    expect(parseAdminEmails(" Tom@Example.com, ,tom@example.com,other@example.com ")).toEqual(
      new Set(["tom@example.com", "other@example.com"]),
    );
  });

  it("returns an empty set when unset or blank", () => {
    expect(parseAdminEmails(undefined)).toEqual(new Set());
    expect(parseAdminEmails("  ,  ")).toEqual(new Set());
  });
});

describe("isAdminEmail", () => {
  const allowlist = new Set(["tom@example.com"]);

  it("matches case-insensitively and tolerates whitespace", () => {
    expect(isAdminEmail(" Tom@Example.COM ", allowlist)).toBe(true);
  });

  it("rejects unknown and blank emails", () => {
    expect(isAdminEmail("other@example.com", allowlist)).toBe(false);
    expect(isAdminEmail("   ", new Set([""]))).toBe(false);
  });
});

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

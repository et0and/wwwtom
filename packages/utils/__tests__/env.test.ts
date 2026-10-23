import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import {
  CommaSeparated,
  TENANT_PREFIXES,
  parseCommaSeparated,
  tenantPrefixFor,
  tenantTagFrom,
} from "@tom/schemas/env";

describe("tenantTagFrom", () => {
  it("accepts the known tenants", () => {
    expect(tenantTagFrom("tom")).toBe("tom");
    expect(tenantTagFrom("sophie")).toBe("sophie");
  });

  it("selects nothing for an unset or unknown tag", () => {
    expect(tenantTagFrom(undefined)).toBeUndefined();
    expect(tenantTagFrom("")).toBeUndefined();
    expect(tenantTagFrom("TOM")).toBeUndefined();
    expect(tenantTagFrom("tom ")).toBeUndefined();
  });
});

describe("tenantPrefixFor", () => {
  it("maps each tenant to its bundle prefix", () => {
    expect(tenantPrefixFor("tom")).toBe(TENANT_PREFIXES.tom);
    expect(tenantPrefixFor("sophie")).toBe(TENANT_PREFIXES.sophie);
  });

  it("selects nothing rather than defaulting", () => {
    expect(tenantPrefixFor(undefined)).toBeUndefined();
    expect(tenantPrefixFor("nope")).toBeUndefined();
  });
});

describe("parseCommaSeparated", () => {
  it("splits and trims", () => {
    expect(parseCommaSeparated("a@example.com,b@example.com")).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
  });

  it("drops blank entries", () => {
    expect(parseCommaSeparated(" a@example.com , , ")).toEqual(["a@example.com"]);
    expect(parseCommaSeparated("")).toEqual([]);
    expect(parseCommaSeparated(undefined)).toEqual([]);
  });
});

describe("CommaSeparated round-trip", () => {
  it("encodes back to a comma-separated string", () => {
    const entries = ["a@example.com", "b@example.com"];
    const encoded = Schema.encodeSync(CommaSeparated)(entries);
    expect(encoded).toBe("a@example.com,b@example.com");
    expect(Schema.decodeSync(CommaSeparated)(encoded)).toEqual(entries);
  });
});

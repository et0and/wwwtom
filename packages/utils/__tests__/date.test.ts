import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "../src/date";

describe("formatDate", () => {
  it("formats a valid date string with long month", () => {
    const formatted = formatDate("2026-09-21");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("September");
  });

  it("formats Date input", () => {
    expect(formatDate(new Date("2026-09-21"))).toContain("2026");
  });

  it("returns empty for null, undefined, and invalid input", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("not-a-date")).toBe("");
    expect(formatDate(new Date("invalid"))).toBe("");
  });
});

describe("formatDateTime", () => {
  it("formats a valid date string with time", () => {
    const formatted = formatDateTime("2026-09-21T10:30:00Z");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("September");
  });

  it("returns empty for null, undefined, and invalid input", () => {
    expect(formatDateTime(null)).toBe("");
    expect(formatDateTime(undefined)).toBe("");
    expect(formatDateTime("not-a-date")).toBe("");
    expect(formatDateTime(new Date("invalid"))).toBe("");
  });
});

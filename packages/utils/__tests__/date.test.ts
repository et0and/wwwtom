import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "../src/date";

describe("formatDate", () => {
  it("formats a valid date string with long month", () => {
    const formatted = formatDate("2026-09-21");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("September");
  });

  it("returns empty for null and unparseable input", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate("not-a-date")).toBe("");
  });

  it("reads a zone-less string as UTC, not as the host timezone", () => {
    // Without the UTC pin this value shifts with the host zone, so the same
    // stored timestamp renders as a different day depending on where it runs.
    expect(formatDate("2026-09-21T10:30")).toBe(formatDate("2026-09-21T10:30:00.000Z"));
  });
});

describe("formatDateTime", () => {
  it("formats a valid date string with time", () => {
    const formatted = formatDateTime("2026-09-21T10:30:00Z");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("September");
  });

  it("returns empty for null and unparseable input", () => {
    expect(formatDateTime(null)).toBe("");
    expect(formatDateTime("not-a-date")).toBe("");
  });

  it("is stable across host timezones", () => {
    const previous = process.env.TZ;
    try {
      process.env.TZ = "Pacific/Auckland";
      const nz = formatDateTime("2026-09-21T10:30:00.000Z");
      process.env.TZ = "America/New_York";
      expect(formatDateTime("2026-09-21T10:30:00.000Z")).toBe(nz);
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
});

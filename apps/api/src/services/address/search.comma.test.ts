import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import { AddressSearchQuerySchema, AddressListQuerySchema } from "@tom/schemas/address";

describe("AddressSearchQuerySchema comma handling", () => {
  it("decodes q with comma as string", () => {
    const decoded = Schema.decodeUnknownSync(AddressSearchQuerySchema)({
      q: "Dominion road, 4",
      limit: "20",
    });
    const qValue = Array.isArray(decoded.q) ? decoded.q.join(",") : decoded.q;
    expect(qValue).toBe("Dominion road, 4");
  });

  it("decodes q as array when Elysia splits on comma", () => {
    const decoded = Schema.decodeUnknownSync(AddressSearchQuerySchema)({
      q: ["Dominion road", " 4"],
      limit: "20",
    });
    const qValue = Array.isArray(decoded.q) ? decoded.q.join(",") : decoded.q;
    expect(qValue).toBe("Dominion road, 4");
  });

  it("decodes q without comma still works", () => {
    const decoded = Schema.decodeUnknownSync(AddressSearchQuerySchema)({
      q: "Dominion road",
      limit: "20",
    });
    const qValue = Array.isArray(decoded.q) ? decoded.q.join(",") : decoded.q;
    expect(qValue).toBe("Dominion road");
  });

  it("decodes bbox with commas as string", () => {
    const decoded = Schema.decodeUnknownSync(AddressSearchQuerySchema)({
      q: "dominion",
      bbox: "174.7,-41.2,174.8,-41.1",
    });
    const bboxRaw = decoded.bbox
      ? Array.isArray(decoded.bbox)
        ? decoded.bbox.join(",")
        : decoded.bbox
      : undefined;
    expect(bboxRaw).toBe("174.7,-41.2,174.8,-41.1");
  });

  it("decodes bbox as array when Elysia splits on comma", () => {
    const decoded = Schema.decodeUnknownSync(AddressSearchQuerySchema)({
      q: "dominion",
      bbox: ["174.7", "-41.2", "174.8", "-41.1"],
    });
    const bboxRaw = decoded.bbox
      ? Array.isArray(decoded.bbox)
        ? decoded.bbox.join(",")
        : decoded.bbox
      : undefined;
    expect(bboxRaw).toBe("174.7,-41.2,174.8,-41.1");
  });

  it("trims q after join and still requires 3 chars", () => {
    const decoded = Schema.decodeUnknownSync(AddressSearchQuerySchema)({
      q: ["Dominion road", " 4"],
      limit: "20",
    });
    const qValue: string = Array.isArray(decoded.q)
      ? (decoded.q as readonly string[]).join(",")
      : (decoded.q as string);
    expect(qValue.trim().length).toBeGreaterThanOrEqual(3);
  });

  it("does not error for Dominion road, 4 after normalization", () => {
    const raw = Schema.decodeUnknownSync(AddressSearchQuerySchema)({
      q: ["Dominion road", " 4"],
      limit: "20",
    });
    const qValue: string = Array.isArray(raw.q) ? raw.q.join(",") : (raw.q as string);
    const decoded = {
      q: qValue,
      limit: raw.limit as string | undefined,
      bbox: undefined,
    } satisfies { q: string; limit?: string | undefined; bbox?: string | undefined };
    expect(decoded.q).toBe("Dominion road, 4");
    expect(decoded.q.trim()).toBe("Dominion road, 4");
  });
});

describe("AddressListQuerySchema bbox comma handling", () => {
  it("decodes bbox with commas", () => {
    const decoded = Schema.decodeUnknownSync(AddressListQuerySchema)({
      bbox: "174.7,-41.2,174.8,-41.1",
      limit: "10",
    });
    const bboxRaw = decoded.bbox
      ? Array.isArray(decoded.bbox)
        ? decoded.bbox.join(",")
        : decoded.bbox
      : undefined;
    expect(bboxRaw).toBe("174.7,-41.2,174.8,-41.1");
  });

  it("decodes bbox as array", () => {
    const decoded = Schema.decodeUnknownSync(AddressListQuerySchema)({
      bbox: ["174.7", "-41.2", "174.8", "-41.1"],
      limit: "10",
    });
    const bboxRaw = decoded.bbox
      ? Array.isArray(decoded.bbox)
        ? decoded.bbox.join(",")
        : decoded.bbox
      : undefined;
    expect(bboxRaw).toBe("174.7,-41.2,174.8,-41.1");
  });
});

import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { buildSpanLatencyQuery, parseSpanLatencyResponse } from "../axiom.ts";

describe("buildSpanLatencyQuery", () => {
  it("filters on the stage annotation and groups by service + operation", () => {
    const query = buildSpanLatencyQuery({ stage: "pr-123", dataset: "tom-traces" });
    expect(query).toContain("['tom-traces']");
    expect(query).toContain("tostring(['attributes.custom']['stage']) == \"pr-123\"");
    expect(query).toContain("by ['service.name'], name");
    expect(query).toContain("percentile(duration, 95)");
  });
});

describe("parseSpanLatencyResponse", () => {
  it("reads tabular columns and converts durations to milliseconds", async () => {
    const spans = await Effect.runPromise(
      parseSpanLatencyResponse({
        tables: [
          {
            fields: [
              { name: "service.name" },
              { name: "name" },
              { name: "count" },
              { name: "p50" },
              { name: "p95" },
            ],
            columns: [
              ["tom-api", "tom-web"],
              ["GET /health", "POST /guestbook"],
              [10, 5],
              [1_500_000, "0.5ms"],
              [9_000_000, "2s"],
            ],
          },
        ],
      }),
    );
    expect(spans).toEqual([
      {
        service: "tom-api",
        operation: "GET /health",
        count: 10,
        p50Ms: 1.5,
        p95Ms: 9,
      },
      {
        service: "tom-web",
        operation: "POST /guestbook",
        count: 5,
        p50Ms: 0.5,
        p95Ms: 2_000,
      },
    ]);
  });

  it("returns an empty list for an empty result", async () => {
    const spans = await Effect.runPromise(parseSpanLatencyResponse({ tables: [] }));
    expect(spans).toEqual([]);
  });

  it("fails with a harness error on an unexpected shape", async () => {
    const error = await Effect.runPromise(
      Effect.flip(parseSpanLatencyResponse({ tables: "nope" })),
    );
    expect(error._tag).toBe("PerformanceHarnessError");
  });
});

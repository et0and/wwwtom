import { describe, expect, it } from "vitest";
import { Effect, Schema } from "effect";
import { collectPerformance } from "../run.ts";
import type { FetchLike } from "../probe.ts";

const RequestBody = Schema.Struct({
  query: Schema.optional(Schema.String),
  apl: Schema.optional(Schema.String),
});

const jsonResponse = (serialized: string): Response =>
  new Response(serialized, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const invocationRow = (requests: number, errors: number, cpuTimeUs: number) => ({
  sum: { requests, errors, subrequests: 0, cpuTimeUs },
  quantiles: { cpuTimeP50: 100, cpuTimeP99: 300, wallTimeP50: 10, wallTimeP99: 20 },
});

const workersPayload = (kind: "candidate" | "baseline") => ({
  data: {
    viewer: {
      accounts: [
        {
          web: [invocationRow(6, 0, kind === "candidate" ? 6000 : 3000)],
          api: [invocationRow(6, 0, 1000)],
          adapter: [invocationRow(6, 0, 2000)],
        },
      ],
    },
  },
});

const spanPayload = (p95Ms: number) => ({
  tables: [
    {
      fields: [
        { name: "service.name" },
        { name: "name" },
        { name: "count" },
        { name: "p50" },
        { name: "p95" },
      ],
      columns: [["tom-web"], ["web.adapterRequest"], [6], [p95Ms * 500_000], [p95Ms * 1_000_000]],
    },
  ],
});

const fetchImpl: FetchLike = async (input, init) => {
  if (input.includes("api.cloudflare.com")) {
    const body = Schema.decodeUnknownSync(RequestBody)(JSON.parse(String(init?.body)));
    const query = body.query ?? "";
    return jsonResponse(
      JSON.stringify(
        workersPayload(query.includes("wwwtom-api-pr-123") ? "candidate" : "baseline"),
      ),
    );
  }
  if (input.includes("api.axiom.co")) {
    const body = Schema.decodeUnknownSync(RequestBody)(JSON.parse(String(init?.body)));
    return jsonResponse(
      JSON.stringify(spanPayload((body.apl ?? "").includes("pr-123") ? 100 : 50)),
    );
  }
  return new Response("ok", { status: 200 });
};

describe("collectPerformance", () => {
  it("probes both stages, queries both backends, and compares", async () => {
    const comparison = await Effect.runPromise(
      collectPerformance({
        candidateStage: "pr-123",
        baselineStage: "staging",
        accountId: "account",
        analyticsToken: "analytics-token",
        axiomToken: "axiom-token",
        rounds: 1,
        warmupRounds: 0,
        analyticsPollMs: 1,
        analyticsTimeoutMs: 100,
        fetchImpl,
      }),
    );

    expect(comparison.probe.candidate).toMatchObject({ requests: 6, failures: 0 });
    expect(comparison.probe.baseline).toMatchObject({ requests: 6, failures: 0 });

    const webCpu = comparison.metrics.find(
      (metric) => metric.app === "web" && metric.metric === "cpuTimePerRequestUs",
    );
    expect(webCpu).toMatchObject({ candidate: 1000, baseline: 500, verdict: "fail" });

    const span = comparison.metrics.find((metric) => metric.metric === "p95 web.adapterRequest");
    expect(span).toMatchObject({ candidate: 100, baseline: 50, verdict: "fail" });

    expect(comparison.verdict).toBe("fail");
    expect(comparison.warnings).toEqual([]);
  });

  it("fails the run when a stage cannot be reached", async () => {
    const failingFetch: FetchLike = async (input) => {
      if (input.includes("tom.so") || input.includes("sophie.st")) throw new Error("blocked");
      return jsonResponse(JSON.stringify({ data: { viewer: { accounts: [] } } }));
    };
    const error = await Effect.runPromise(
      Effect.flip(
        collectPerformance({
          candidateStage: "pr-123",
          baselineStage: "staging",
          accountId: "account",
          analyticsToken: "analytics-token",
          rounds: 1,
          warmupRounds: 0,
          fetchImpl: failingFetch,
        }),
      ),
    );
    expect(error._tag).toBe("PerformanceHarnessError");
  });
});

import { describe, expect, it } from "vitest";
import { buildComparison, renderMarkdown, type StageMetrics } from "../compare.ts";
import type { WorkerInvocationMetrics } from "../cloudflare-analytics.ts";

const invocation = (
  app: WorkerInvocationMetrics["app"],
  values: Pick<
    WorkerInvocationMetrics,
    "requests" | "errors" | "cpuTimeUs" | "cpuTimeP99Us" | "wallTimeP99Ms"
  >,
): WorkerInvocationMetrics => ({
  app,
  scriptName: `wwwtom-${app}-pr-123`,
  subrequests: 0,
  cpuTimeP50Us: undefined,
  wallTimeP50Ms: undefined,
  ...values,
});

const stageMetrics = (overrides: Partial<StageMetrics> = {}): StageMetrics => ({
  stage: "pr-123",
  invocations: [
    invocation("web", {
      requests: 10,
      errors: 0,
      cpuTimeUs: 2000,
      cpuTimeP99Us: 300,
      wallTimeP99Ms: 40,
    }),
  ],
  probe: { requests: 12, failures: 0, medianDurationMs: 50 },
  spans: [{ service: "tom-api", operation: "GET /health", count: 10, p50Ms: 1, p95Ms: 100 }],
  ...overrides,
});

const baselineMetrics = (): StageMetrics => ({
  stage: "staging",
  invocations: [
    invocation("web", {
      requests: 10,
      errors: 0,
      cpuTimeUs: 1000,
      cpuTimeP99Us: 300,
      wallTimeP99Ms: 40,
    }),
  ],
  probe: { requests: 12, failures: 0, medianDurationMs: 45 },
  spans: [{ service: "tom-api", operation: "GET /health", count: 10, p50Ms: 1, p95Ms: 50 }],
});

const window = {
  startedAt: "2026-09-30T00:00:00.000Z",
  finishedAt: "2026-09-30T00:05:00.000Z",
};

describe("buildComparison", () => {
  it("flags a CPU regression as fail and a span regression too", () => {
    const comparison = buildComparison({
      candidate: stageMetrics(),
      baseline: baselineMetrics(),
      window,
    });
    const cpu = comparison.metrics.find(
      (metric) => metric.app === "web" && metric.metric === "cpuTimePerRequestUs",
    );
    expect(cpu).toMatchObject({
      candidate: 200,
      baseline: 100,
      deltaPercent: 100,
      verdict: "fail",
    });
    const span = comparison.metrics.find((metric) => metric.metric === "p95 GET /health");
    expect(span).toMatchObject({ deltaPercent: 100, verdict: "fail" });
    expect(comparison.verdict).toBe("fail");
  });

  it("warns on a small error-rate increase", () => {
    const candidate = stageMetrics({
      invocations: [
        invocation("web", {
          requests: 100,
          errors: 1,
          cpuTimeUs: 10_000,
          cpuTimeP99Us: 300,
          wallTimeP99Ms: 40,
        }),
      ],
    });
    const baseline = stageMetrics({
      invocations: [
        invocation("web", {
          requests: 100,
          errors: 0,
          cpuTimeUs: 10_000,
          cpuTimeP99Us: 300,
          wallTimeP99Ms: 40,
        }),
      ],
    });
    const comparison = buildComparison({ candidate, baseline, window });
    const errorRate = comparison.metrics.find((metric) => metric.metric === "errorRatePercent");
    expect(errorRate).toMatchObject({ candidate: 1, baseline: 0, verdict: "warn" });
  });

  it("marks a metric unknown when the baseline has no data", () => {
    const baseline = baselineMetrics();
    const zeroRequests = { ...baseline.invocations[0]!, requests: 0 };
    const comparison = buildComparison({
      candidate: stageMetrics(),
      baseline: { ...baseline, invocations: [zeroRequests] },
      window,
    });
    const cpu = comparison.metrics.find(
      (metric) => metric.app === "web" && metric.metric === "cpuTimePerRequestUs",
    );
    expect(cpu?.verdict).toBe("unknown");
  });
});

describe("renderMarkdown", () => {
  it("renders the verdict, metric table, and warnings", () => {
    const comparison = buildComparison({
      candidate: stageMetrics(),
      baseline: baselineMetrics(),
      window,
      warnings: ["AXIOM_QUERY_TOKEN is not set; span latency skipped"],
    });
    const markdown = renderMarkdown(comparison);
    expect(markdown).toContain("## Perf: `pr-123` vs `staging`");
    expect(markdown).toContain("Verdict: **fail**");
    expect(markdown).toContain("| web | cpuTimePerRequestUs | 200.00 | 100.00 | +100.0 | fail |");
    expect(markdown).toContain("- AXIOM_QUERY_TOKEN is not set; span latency skipped");
  });
});

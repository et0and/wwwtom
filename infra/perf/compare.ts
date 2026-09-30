import type { SpanLatency } from "./axiom.ts";
import type { WorkerInvocationMetrics } from "./cloudflare-analytics.ts";
import type { ProbeSummary } from "./probe.ts";

export type PerfThresholds = {
  /** CPU time per request: warn/fail at this percent regression. */
  readonly cpuWarnPercent: number;
  readonly cpuFailPercent: number;
  /** Span p95 latency: warn/fail at this percent regression. */
  readonly latencyWarnPercent: number;
  readonly latencyFailPercent: number;
  /** Error rate: warn/fail at this percentage-point increase. */
  readonly errorRateWarnPoints: number;
  readonly errorRateFailPoints: number;
};

export const DEFAULT_THRESHOLDS: PerfThresholds = {
  cpuWarnPercent: 10,
  cpuFailPercent: 25,
  latencyWarnPercent: 10,
  latencyFailPercent: 25,
  errorRateWarnPoints: 0.5,
  errorRateFailPoints: 5,
};

export type MetricVerdict = "ok" | "warn" | "fail" | "unknown";

export type MetricComparison = {
  readonly app: string;
  readonly metric: string;
  readonly candidate: number | undefined;
  readonly baseline: number | undefined;
  readonly deltaPercent: number | undefined;
  readonly verdict: MetricVerdict;
};

export type StageMetrics = {
  readonly stage: string;
  readonly invocations: readonly WorkerInvocationMetrics[];
  readonly probe: ProbeSummary;
  readonly spans: readonly SpanLatency[];
};

export type PerformanceComparison = {
  readonly candidateStage: string;
  readonly baselineStage: string;
  readonly window: { readonly startedAt: string; readonly finishedAt: string };
  readonly metrics: readonly MetricComparison[];
  readonly probe: { readonly candidate: ProbeSummary; readonly baseline: ProbeSummary };
  readonly warnings: readonly string[];
  readonly verdict: MetricVerdict;
};

const higherIsWorseVerdict = (
  candidate: number | undefined,
  baseline: number | undefined,
  warnThreshold: number,
  failThreshold: number,
): MetricVerdict => {
  if (candidate === undefined || baseline === undefined || baseline === 0) return "unknown";
  const deltaPercent = ((candidate - baseline) / baseline) * 100;
  if (deltaPercent >= failThreshold) return "fail";
  if (deltaPercent >= warnThreshold) return "warn";
  return "ok";
};

const errorRateVerdict = (
  candidate: number | undefined,
  baseline: number | undefined,
  warnPoints: number,
  failPoints: number,
): MetricVerdict => {
  if (candidate === undefined || baseline === undefined) return "unknown";
  const deltaPoints = candidate - baseline;
  if (deltaPoints >= failPoints) return "fail";
  if (deltaPoints >= warnPoints) return "warn";
  return "ok";
};

const percentDelta = (
  candidate: number | undefined,
  baseline: number | undefined,
): number | undefined => {
  if (candidate === undefined || baseline === undefined || baseline === 0) return undefined;
  return ((candidate - baseline) / baseline) * 100;
};

const cpuPerRequestUs = (metrics: WorkerInvocationMetrics): number | undefined =>
  metrics.requests > 0 ? metrics.cpuTimeUs / metrics.requests : undefined;

const errorRatePercent = (metrics: WorkerInvocationMetrics): number | undefined =>
  metrics.requests > 0 ? (metrics.errors / metrics.requests) * 100 : undefined;

const invocationMetrics = (
  app: WorkerInvocationMetrics["app"],
  candidate: StageMetrics,
  baseline: StageMetrics,
  thresholds: PerfThresholds,
): readonly MetricComparison[] => {
  const candidateMetrics = candidate.invocations.find((metrics) => metrics.app === app);
  const baselineMetrics = baseline.invocations.find((metrics) => metrics.app === app);
  if (candidateMetrics === undefined || baselineMetrics === undefined) return [];

  const rows = [
    "cpuTimePerRequestUs",
    "cpuTimeP99Us",
    "wallTimeP99Ms",
    "errorRatePercent",
  ] as const;

  return rows.map((metric) => {
    switch (metric) {
      case "cpuTimePerRequestUs": {
        const candidateValue = cpuPerRequestUs(candidateMetrics);
        const baselineValue = cpuPerRequestUs(baselineMetrics);
        return {
          app,
          metric,
          candidate: candidateValue,
          baseline: baselineValue,
          deltaPercent: percentDelta(candidateValue, baselineValue),
          verdict: higherIsWorseVerdict(
            candidateValue,
            baselineValue,
            thresholds.cpuWarnPercent,
            thresholds.cpuFailPercent,
          ),
        };
      }
      case "cpuTimeP99Us": {
        const candidateValue = candidateMetrics.cpuTimeP99Us;
        const baselineValue = baselineMetrics.cpuTimeP99Us;
        return {
          app,
          metric,
          candidate: candidateValue,
          baseline: baselineValue,
          deltaPercent: percentDelta(candidateValue, baselineValue),
          verdict: higherIsWorseVerdict(
            candidateValue,
            baselineValue,
            thresholds.cpuWarnPercent,
            thresholds.cpuFailPercent,
          ),
        };
      }
      case "wallTimeP99Ms": {
        const candidateValue = candidateMetrics.wallTimeP99Ms;
        const baselineValue = baselineMetrics.wallTimeP99Ms;
        return {
          app,
          metric,
          candidate: candidateValue,
          baseline: baselineValue,
          deltaPercent: percentDelta(candidateValue, baselineValue),
          verdict: higherIsWorseVerdict(
            candidateValue,
            baselineValue,
            thresholds.latencyWarnPercent,
            thresholds.latencyFailPercent,
          ),
        };
      }
      default: {
        const candidateValue = errorRatePercent(candidateMetrics);
        const baselineValue = errorRatePercent(baselineMetrics);
        return {
          app,
          metric,
          candidate: candidateValue,
          baseline: baselineValue,
          deltaPercent: percentDelta(candidateValue, baselineValue),
          verdict: errorRateVerdict(
            candidateValue,
            baselineValue,
            thresholds.errorRateWarnPoints,
            thresholds.errorRateFailPoints,
          ),
        };
      }
    }
  });
};

const spanMetrics = (
  candidate: StageMetrics,
  baseline: StageMetrics,
  thresholds: PerfThresholds,
): readonly MetricComparison[] =>
  candidate.spans.map((span) => {
    const counterpart = baseline.spans.find(
      (baselineSpan) =>
        baselineSpan.service === span.service && baselineSpan.operation === span.operation,
    );
    return {
      app: span.service,
      metric: `p95 ${span.operation}`,
      candidate: span.p95Ms,
      baseline: counterpart?.p95Ms,
      deltaPercent: percentDelta(span.p95Ms, counterpart?.p95Ms),
      verdict: higherIsWorseVerdict(
        span.p95Ms,
        counterpart?.p95Ms,
        thresholds.latencyWarnPercent,
        thresholds.latencyFailPercent,
      ),
    };
  });

const overallVerdict = (metrics: readonly MetricComparison[]): MetricVerdict => {
  if (metrics.some((metric) => metric.verdict === "fail")) return "fail";
  if (metrics.some((metric) => metric.verdict === "warn")) return "warn";
  return "ok";
};

export const buildComparison = (options: {
  readonly candidate: StageMetrics;
  readonly baseline: StageMetrics;
  readonly window: { readonly startedAt: string; readonly finishedAt: string };
  readonly warnings?: readonly string[];
  readonly thresholds?: PerfThresholds;
}): PerformanceComparison => {
  const thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;
  const metrics = [
    ...invocationMetrics("web", options.candidate, options.baseline, thresholds),
    ...invocationMetrics("api", options.candidate, options.baseline, thresholds),
    ...invocationMetrics("adapter", options.candidate, options.baseline, thresholds),
    ...spanMetrics(options.candidate, options.baseline, thresholds),
  ];
  return {
    candidateStage: options.candidate.stage,
    baselineStage: options.baseline.stage,
    window: options.window,
    metrics,
    probe: { candidate: options.candidate.probe, baseline: options.baseline.probe },
    warnings: options.warnings ?? [],
    verdict: overallVerdict(metrics),
  };
};

const fixed = (value: number | undefined, digits: number): string =>
  value === undefined ? "-" : value.toFixed(digits);

const signed = (value: number | undefined, digits: number): string => {
  if (value === undefined) return "-";
  const formatted = value.toFixed(digits);
  return value >= 0 ? `+${formatted}` : formatted;
};

export const renderMarkdown = (comparison: PerformanceComparison): string => {
  const lines = [
    `## Perf: \`${comparison.candidateStage}\` vs \`${comparison.baselineStage}\``,
    "",
    `Verdict: **${comparison.verdict}** · window ${comparison.window.startedAt} → ${comparison.window.finishedAt}`,
    "",
    "| App | Metric | Candidate | Baseline | Δ% | Verdict |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const metric of comparison.metrics) {
    lines.push(
      `| ${metric.app} | ${metric.metric} | ${fixed(metric.candidate, 2)} | ${fixed(metric.baseline, 2)} | ${signed(metric.deltaPercent, 1)} | ${metric.verdict} |`,
    );
  }
  lines.push(
    "",
    `Probe: candidate ${comparison.probe.candidate.requests} requests (${comparison.probe.candidate.failures} failed), baseline ${comparison.probe.baseline.requests} requests (${comparison.probe.baseline.failures} failed).`,
  );
  if (comparison.warnings.length > 0) {
    lines.push("", "Warnings:");
    lines.push(...comparison.warnings.map((warning) => `- ${warning}`));
  }
  return lines.join("\n");
};

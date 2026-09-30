import { Clock, Effect } from "effect";
import { PerformanceHarnessError } from "@tom/types/errors";
import { querySpanLatencies, type SpanLatency } from "./axiom.ts";
import {
  queryWorkersInvocationMetrics,
  workerScriptNames,
  type WorkerInvocationMetrics,
} from "./cloudflare-analytics.ts";
import { buildComparison, type PerformanceComparison, type PerfThresholds } from "./compare.ts";
import {
  expectProbeReachable,
  probeRequests,
  runProbe,
  summarizeProbe,
  type FetchLike,
  type RunProbeOptions,
} from "./probe.ts";

/** Analytics indexing lag; poll until the window is complete instead of guessing. */
export const DEFAULT_ANALYTICS_TIMEOUT_MS = 10 * 60_000;
export const DEFAULT_ANALYTICS_POLL_MS = 20_000;

/** Pad the query window so minute-bucket boundaries cannot clip probe rows. */
export const WINDOW_PADDING_MS = 60_000;

export type CollectPerformanceOptions = {
  readonly candidateStage: string;
  readonly baselineStage: string;
  readonly accountId: string;
  readonly analyticsToken: string;
  readonly probeToken?: string;
  readonly axiomToken?: string;
  readonly axiomDataset?: string;
  readonly rounds?: number;
  readonly warmupRounds?: number;
  readonly fetchImpl?: FetchLike;
  readonly thresholds?: PerfThresholds;
  readonly analyticsTimeoutMs?: number;
  readonly analyticsPollMs?: number;
};

const probeOptionsFor = (
  options: CollectPerformanceOptions,
  fetchImpl: FetchLike,
): RunProbeOptions => ({
  fetchImpl,
  rounds: options.rounds ?? 3,
  warmupRounds: options.warmupRounds ?? 1,
  ...(options.probeToken && { probeToken: options.probeToken }),
});

const metricsTotal = (metrics: readonly WorkerInvocationMetrics[]): number =>
  metrics.reduce((total, metric) => total + metric.requests, 0);

/**
 * Poll Cloudflare analytics until both stages report at least half of the
 * expected measured probe requests. Client-side probe failures never reach
 * the worker, so the bound is deliberately loose; on timeout the run
 * proceeds and the report shows whatever arrived.
 */
const waitForAnalytics = (config: {
  readonly candidateScripts: ReturnType<typeof workerScriptNames>;
  readonly baselineScripts: ReturnType<typeof workerScriptNames>;
  readonly candidateMinimum: number;
  readonly baselineMinimum: number;
  readonly accountId: string;
  readonly token: string;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs: number;
  readonly pollMs: number;
}): Effect.Effect<void> =>
  Effect.gen(function* () {
    const deadline = (yield* Clock.currentTimeMillis) + config.timeoutMs;
    while ((yield* Clock.currentTimeMillis) < deadline) {
      const totals = yield* Effect.all(
        [
          queryWorkersInvocationMetrics(config.candidateScripts, config),
          queryWorkersInvocationMetrics(config.baselineScripts, config),
        ],
        { concurrency: 2 },
      ).pipe(
        Effect.map(([candidateMetrics, baselineMetrics]) => ({
          candidate: metricsTotal(candidateMetrics),
          baseline: metricsTotal(baselineMetrics),
        })),
        Effect.catch(() => Effect.succeed(undefined)),
      );
      const arrived =
        totals !== undefined &&
        totals.candidate >= config.candidateMinimum &&
        totals.baseline >= config.baselineMinimum;
      if (arrived) return;
      yield* Effect.sleep(config.pollMs);
    }
  });

const querySpans = (options: {
  readonly stage: string;
  readonly token: string | undefined;
  readonly dataset: string;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly fetchImpl: FetchLike;
}): Effect.Effect<readonly SpanLatency[], PerformanceHarnessError> =>
  options.token === undefined
    ? Effect.succeed<readonly SpanLatency[]>([])
    : querySpanLatencies({
        stage: options.stage,
        dataset: options.dataset,
        token: options.token,
        startedAt: options.startedAt,
        finishedAt: options.finishedAt,
        fetchImpl: options.fetchImpl,
      });

/**
 * Probe both stages in one window, wait for observability to catch up, then
 * compare candidate vs baseline. Analytics and Axiom failures that are not
 * fatal surface as report warnings.
 */
export const collectPerformance = (
  options: CollectPerformanceOptions,
): Effect.Effect<PerformanceComparison, PerformanceHarnessError> =>
  Effect.gen(function* () {
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    const rounds = options.rounds ?? 3;

    const startedAt = new Date(yield* Clock.currentTimeMillis);
    const probes = yield* Effect.all(
      {
        candidate: runProbe(options.candidateStage, probeOptionsFor(options, fetchImpl)),
        baseline: runProbe(options.baselineStage, probeOptionsFor(options, fetchImpl)),
      },
      { concurrency: 2 },
    );
    const finishedAt = new Date(yield* Clock.currentTimeMillis);

    yield* expectProbeReachable(probes.candidate);
    yield* expectProbeReachable(probes.baseline);

    const queryStartedAt = new Date(startedAt.getTime() - WINDOW_PADDING_MS);
    const queryFinishedAt = new Date(finishedAt.getTime() + WINDOW_PADDING_MS);
    const candidateScripts = workerScriptNames(options.candidateStage);
    const baselineScripts = workerScriptNames(options.baselineStage);
    const perRoundRequests = probeRequests(options.candidateStage).length;

    yield* waitForAnalytics({
      candidateScripts,
      baselineScripts,
      candidateMinimum: Math.floor(rounds * perRoundRequests * 0.5),
      baselineMinimum: Math.floor(rounds * perRoundRequests * 0.5),
      accountId: options.accountId,
      token: options.analyticsToken,
      startedAt: queryStartedAt,
      finishedAt: queryFinishedAt,
      fetchImpl,
      timeoutMs: options.analyticsTimeoutMs ?? DEFAULT_ANALYTICS_TIMEOUT_MS,
      pollMs: options.analyticsPollMs ?? DEFAULT_ANALYTICS_POLL_MS,
    });

    const queryOptions = {
      accountId: options.accountId,
      token: options.analyticsToken,
      startedAt: queryStartedAt,
      finishedAt: queryFinishedAt,
      fetchImpl,
    };
    const [candidateInvocations, baselineInvocations] = yield* Effect.all(
      [
        queryWorkersInvocationMetrics(candidateScripts, queryOptions),
        queryWorkersInvocationMetrics(baselineScripts, queryOptions),
      ],
      { concurrency: 2 },
    );

    const axiomDataset = options.axiomDataset ?? "tom-traces";
    const spanOptions = {
      token: options.axiomToken,
      dataset: axiomDataset,
      startedAt: queryStartedAt,
      finishedAt: queryFinishedAt,
      fetchImpl,
    };
    const spanResults = yield* Effect.all(
      {
        candidate: querySpans({ ...spanOptions, stage: options.candidateStage }),
        baseline: querySpans({ ...spanOptions, stage: options.baselineStage }),
      },
      { concurrency: 2 },
    ).pipe(
      Effect.map((spans) => ({ ...spans, warning: undefined })),
      Effect.catch((error) =>
        Effect.succeed({
          candidate: [] as readonly SpanLatency[],
          baseline: [] as readonly SpanLatency[],
          warning: `Span latency skipped: ${error.message}`,
        }),
      ),
    );

    const warnings = [
      ...(spanResults.warning === undefined ? [] : [spanResults.warning]),
      ...(options.axiomToken === undefined && spanResults.warning === undefined
        ? ["AXIOM_QUERY_TOKEN is not set; span latency skipped"]
        : []),
    ];

    return buildComparison({
      candidate: {
        stage: options.candidateStage,
        invocations: candidateInvocations,
        probe: summarizeProbe(probes.candidate),
        spans: spanResults.candidate,
      },
      baseline: {
        stage: options.baselineStage,
        invocations: baselineInvocations,
        probe: summarizeProbe(probes.baseline),
        spans: spanResults.baseline,
      },
      window: { startedAt: startedAt.toISOString(), finishedAt: finishedAt.toISOString() },
      warnings,
      ...(options.thresholds && { thresholds: options.thresholds }),
    });
  });

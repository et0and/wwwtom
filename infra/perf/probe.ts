import { Clock, Effect } from "effect";
import { PerformanceHarnessError } from "@tom/types/errors";
import { toErrorMessage } from "@tom/utils/services/worker";
import { stageHost, stageWebHost } from "../utils/stage-hosts.ts";

/** Header that marks synthetic perf traffic (the WAF skip rule matches it). */
export const PROBE_HEADER = "x-perf-probe";

/** Abort a hung probe so one bad request cannot stall the run. */
export const PROBE_TIMEOUT_MS = 30_000;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type ProbeApp = "web" | "api" | "adapter";

export type ProbeRequest = {
  readonly app: ProbeApp;
  readonly name: string;
  readonly url: string;
};

export type ProbeResult = {
  readonly app: ProbeApp;
  readonly name: string;
  readonly url: string;
  /** HTTP status; 0 when the request failed before a response. */
  readonly status: number;
  readonly durationMs: number;
  readonly error?: string;
};

export type ProbeRound = {
  readonly results: readonly ProbeResult[];
};

export type StageProbe = {
  readonly stage: string;
  readonly rounds: readonly ProbeRound[];
};

export type ProbeSummary = {
  readonly requests: number;
  readonly failures: number;
  /** Median client-observed duration across all measured probe requests. */
  readonly medianDurationMs: number | undefined;
};

/**
 * Read-only request mix, one request per URL per round, run sequentially.
 * Both stages receive the same shape of traffic in the same window, so the
 * server-side comparison is like-for-like.
 */
export const probeRequests = (stage: string): readonly ProbeRequest[] => [
  { app: "web", name: "home", url: `https://${stageWebHost(stage)}/` },
  { app: "web", name: "posts", url: `https://${stageWebHost(stage)}/posts` },
  { app: "web", name: "guestbook", url: `https://${stageWebHost(stage)}/guestbook` },
  {
    app: "adapter",
    name: "content-posts",
    url: `https://${stageHost(stage, "adapter")}/content/arena/posts`,
  },
  {
    app: "adapter",
    name: "polar-products",
    url: `https://${stageHost(stage, "adapter")}/polar/products`,
  },
  { app: "api", name: "health", url: `https://${stageHost(stage, "api")}/health` },
];

export type ProbeOptions = {
  readonly fetchImpl: FetchLike;
  readonly probeToken?: string;
};

/**
 * One request, timed with the Effect clock. Failures are recorded as results
 * (status 0 + error) instead of failing the round, so a blocked probe still
 * shows up in the report.
 */
export const runProbeRequest = (
  request: ProbeRequest,
  options: ProbeOptions,
): Effect.Effect<ProbeResult> =>
  Effect.gen(function* () {
    const startedAt = yield* Clock.currentTimeMillis;
    const outcome = yield* Effect.tryPromise({
      try: async () => {
        const response = await options.fetchImpl(request.url, {
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
          ...(options.probeToken && { headers: { [PROBE_HEADER]: options.probeToken } }),
        });
        await response.arrayBuffer();
        return response.status;
      },
      catch: (cause) => cause,
    }).pipe(
      Effect.map((status) => ({ ok: true as const, status })),
      Effect.catch((cause) => Effect.succeed({ ok: false as const, cause })),
    );
    const finishedAt = yield* Clock.currentTimeMillis;
    const durationMs = finishedAt - startedAt;
    return outcome.ok
      ? { ...request, status: outcome.status, durationMs }
      : { ...request, status: 0, durationMs, error: toErrorMessage(outcome.cause) };
  });

/** One sequential pass over every request in the mix. */
export const runProbeRound = (
  requests: readonly ProbeRequest[],
  options: ProbeOptions,
): Effect.Effect<ProbeRound> =>
  Effect.forEach(requests, (request) => runProbeRequest(request, options), {
    concurrency: 1,
  }).pipe(Effect.map((results) => ({ results })));

export type RunProbeOptions = ProbeOptions & {
  readonly rounds: number;
  /** Discarded warmup passes that prime JIT and caches. Defaults to 1. */
  readonly warmupRounds?: number;
};

/** Warmup passes, then the measured passes. */
export const runProbe = (stage: string, options: RunProbeOptions): Effect.Effect<StageProbe> =>
  Effect.gen(function* () {
    const requests = probeRequests(stage);
    const warmupRounds = options.warmupRounds ?? 1;
    yield* Effect.forEach(
      Array.from({ length: warmupRounds }),
      () => runProbeRound(requests, options),
      { concurrency: 1, discard: true },
    );
    const rounds = yield* Effect.forEach(
      Array.from({ length: options.rounds }),
      () => runProbeRound(requests, options),
      { concurrency: 1 },
    );
    return { stage, rounds };
  });

const median = (values: readonly number[]): number | undefined => {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  if (sorted.length % 2 === 1) return upper;
  return ((sorted[middle - 1] ?? upper) + upper) / 2;
};

export const summarizeProbe = (probe: StageProbe): ProbeSummary => {
  const results = probe.rounds.flatMap((round) => round.results);
  const failures = results.filter((result) => result.status === 0).length;
  return {
    requests: results.length,
    failures,
    medianDurationMs: median(results.map((result) => result.durationMs)),
  };
};

/** Fail loudly when a probe never reached a stage (wrong host, DNS, auth). */
export const expectProbeReachable = (
  probe: StageProbe,
  options: { readonly minimumSuccessRatio?: number } = {},
): Effect.Effect<void, PerformanceHarnessError> => {
  const minimumSuccessRatio = options.minimumSuccessRatio ?? 0.5;
  const summary = summarizeProbe(probe);
  const successRatio = summary.requests === 0 ? 0 : 1 - summary.failures / summary.requests;
  if (summary.requests > 0 && successRatio >= minimumSuccessRatio) return Effect.void;
  return Effect.fail(
    new PerformanceHarnessError({
      message: `Probe for stage '${probe.stage}' reached ${summary.requests - summary.failures}/${summary.requests} requests`,
    }),
  );
};

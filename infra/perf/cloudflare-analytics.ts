import { Effect, Schema } from "effect";
import { PerformanceHarnessError } from "@tom/types/errors";
import type { FetchLike } from "./probe.ts";

export const CLOUDFLARE_GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";

/** Worker script names per app, mirroring infra/apps/*.run.ts. */
export type WorkerScriptNames = {
  readonly web: string;
  readonly api: string;
  readonly adapter: string;
};

export const workerScriptNames = (stage: string): WorkerScriptNames =>
  stage === "production"
    ? { web: "wwwtom", api: "apitom", adapter: "wwwtom-adapter" }
    : {
        web: `wwwtom-${stage}`,
        api: `wwwtom-api-${stage}`,
        adapter: `wwwtom-adapter-${stage}`,
      };

/**
 * Invocation metrics for one app. Quantiles are the worst minute in the
 * window (adaptive sampling returns several rows per script); `cpuTimeP50Us`
 * and `cpuTimeP99Us` are microseconds, `wallTimeP50Ms` and `wallTimeP99Ms`
 * milliseconds, matching the GraphQL schema units.
 */
export type WorkerInvocationMetrics = {
  readonly app: keyof WorkerScriptNames;
  readonly scriptName: string;
  readonly requests: number;
  readonly errors: number;
  readonly subrequests: number;
  readonly cpuTimeUs: number;
  readonly cpuTimeP50Us: number | undefined;
  readonly cpuTimeP99Us: number | undefined;
  readonly wallTimeP50Ms: number | undefined;
  readonly wallTimeP99Ms: number | undefined;
};

const INVOCATION_FIELDS = `
  sum { requests errors subrequests cpuTimeUs }
  quantiles { cpuTimeP50 cpuTimeP99 wallTimeP50 wallTimeP99 }
`;

/**
 * One aliased `workersInvocationsAdaptive` node per app: a single script
 * filter per node is the documented shape, and aliases keep the response
 * fully typed (no dynamic record keys).
 */
export const buildWorkersAnalyticsQuery = (scripts: WorkerScriptNames): string =>
  `query PerfWorkersAnalytics($accountTag: string!, $datetimeStart: string!, $datetimeEnd: string!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      web: workersInvocationsAdaptive(limit: 1000, filter: { scriptName: ${JSON.stringify(scripts.web)}, datetime_geq: $datetimeStart, datetime_leq: $datetimeEnd }) {${INVOCATION_FIELDS}}
      api: workersInvocationsAdaptive(limit: 1000, filter: { scriptName: ${JSON.stringify(scripts.api)}, datetime_geq: $datetimeStart, datetime_leq: $datetimeEnd }) {${INVOCATION_FIELDS}}
      adapter: workersInvocationsAdaptive(limit: 1000, filter: { scriptName: ${JSON.stringify(scripts.adapter)}, datetime_geq: $datetimeStart, datetime_leq: $datetimeEnd }) {${INVOCATION_FIELDS}}
    }
  }
}`;

const InvocationRow = Schema.Struct({
  sum: Schema.Struct({
    requests: Schema.Number,
    errors: Schema.Number,
    subrequests: Schema.Number,
    cpuTimeUs: Schema.Number,
  }),
  quantiles: Schema.Struct({
    cpuTimeP50: Schema.optional(Schema.NullOr(Schema.Number)),
    cpuTimeP99: Schema.optional(Schema.NullOr(Schema.Number)),
    wallTimeP50: Schema.optional(Schema.NullOr(Schema.Number)),
    wallTimeP99: Schema.optional(Schema.NullOr(Schema.Number)),
  }),
});

const AccountsRow = Schema.Struct({
  web: Schema.optional(Schema.Array(InvocationRow)),
  api: Schema.optional(Schema.Array(InvocationRow)),
  adapter: Schema.optional(Schema.Array(InvocationRow)),
});

const AnalyticsResponse = Schema.Struct({
  data: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        viewer: Schema.Struct({ accounts: Schema.Array(AccountsRow) }),
      }),
    ),
  ),
  errors: Schema.optional(Schema.Array(Schema.Struct({ message: Schema.String }))),
});

const maxDefined = (values: ReadonlyArray<number | null | undefined>): number | undefined => {
  const defined = values.filter((value): value is number => value !== null && value !== undefined);
  if (defined.length === 0) return undefined;
  return Math.max(...defined);
};

const aggregateApp = (
  app: keyof WorkerScriptNames,
  scriptName: string,
  rows: ReadonlyArray<Schema.Schema.Type<typeof InvocationRow>>,
): WorkerInvocationMetrics => ({
  app,
  scriptName,
  requests: rows.reduce((total, row) => total + row.sum.requests, 0),
  errors: rows.reduce((total, row) => total + row.sum.errors, 0),
  subrequests: rows.reduce((total, row) => total + row.sum.subrequests, 0),
  cpuTimeUs: rows.reduce((total, row) => total + row.sum.cpuTimeUs, 0),
  cpuTimeP50Us: maxDefined(rows.map((row) => row.quantiles.cpuTimeP50)),
  cpuTimeP99Us: maxDefined(rows.map((row) => row.quantiles.cpuTimeP99)),
  wallTimeP50Ms: maxDefined(rows.map((row) => row.quantiles.wallTimeP50)),
  wallTimeP99Ms: maxDefined(rows.map((row) => row.quantiles.wallTimeP99)),
});

export const parseWorkersAnalyticsResponse = (
  scripts: WorkerScriptNames,
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- decoded by Schema at the HTTP boundary
  payload: unknown,
): Effect.Effect<readonly WorkerInvocationMetrics[], PerformanceHarnessError> =>
  Schema.decodeUnknownEffect(AnalyticsResponse)(payload).pipe(
    Effect.mapError(
      (cause) =>
        new PerformanceHarnessError({
          message: "Unexpected Cloudflare analytics response shape",
          cause,
        }),
    ),
    Effect.flatMap((response) => {
      if (response.errors && response.errors.length > 0) {
        return Effect.fail(
          new PerformanceHarnessError({
            message: `Cloudflare analytics error: ${response.errors.map((error) => error.message).join("; ")}`,
          }),
        );
      }
      const accounts = response.data?.viewer.accounts ?? [];
      const account = accounts[0] ?? {};
      return Effect.succeed([
        aggregateApp("web", scripts.web, account.web ?? []),
        aggregateApp("api", scripts.api, account.api ?? []),
        aggregateApp("adapter", scripts.adapter, account.adapter ?? []),
      ]);
    }),
  );

export type QueryWorkersMetricsOptions = {
  readonly accountId: string;
  readonly token: string;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly fetchImpl: FetchLike;
};

export const queryWorkersInvocationMetrics = (
  scripts: WorkerScriptNames,
  options: QueryWorkersMetricsOptions,
): Effect.Effect<readonly WorkerInvocationMetrics[], PerformanceHarnessError> =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () =>
        options.fetchImpl(CLOUDFLARE_GRAPHQL_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: buildWorkersAnalyticsQuery(scripts),
            variables: {
              accountTag: options.accountId,
              datetimeStart: options.startedAt.toISOString(),
              datetimeEnd: options.finishedAt.toISOString(),
            },
          }),
        }),
      catch: (cause) =>
        new PerformanceHarnessError({
          message: "Cloudflare analytics request failed",
          cause,
        }),
    });
    if (!response.ok) {
      return yield* new PerformanceHarnessError({
        message: `Cloudflare analytics returned HTTP ${response.status}`,
      });
    }
    const payload = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (cause) =>
        new PerformanceHarnessError({
          message: "Cloudflare analytics response was not JSON",
          cause,
        }),
    });
    return yield* parseWorkersAnalyticsResponse(scripts, payload);
  });

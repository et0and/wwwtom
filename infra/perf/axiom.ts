import { Effect, Predicate, Schema } from "effect";
import { PerformanceHarnessError } from "@tom/types/errors";
import type { FetchLike } from "./probe.ts";

export const AXIOM_QUERY_URL = "https://api.axiom.co/v1/datasets/_apl?format=tabular";

export const DEFAULT_TRACES_DATASET = "tom-traces";

/**
 * Span latency per service + operation. Axiom exposes custom span
 * annotations through `attributes.custom`; the `stage` annotation (see
 * withLogging) is what separates candidate and baseline stages that share a
 * service name.
 */
export type SpanLatency = {
  readonly service: string;
  readonly operation: string;
  readonly count: number;
  readonly p50Ms: number | undefined;
  readonly p95Ms: number | undefined;
};

export type SpanLatencyQueryOptions = {
  readonly stage: string;
  readonly dataset: string;
  readonly limit?: number;
};

export const buildSpanLatencyQuery = (options: SpanLatencyQueryOptions): string => {
  const limit = options.limit ?? 50;
  return `['${options.dataset}']
| where tostring(['attributes.custom']['stage']) == ${JSON.stringify(options.stage)}
| where isnotnull(duration)
| summarize count = count(), p50 = percentile(duration, 50), p95 = percentile(duration, 95) by ['service.name'], name
| order by p95 desc
| limit ${limit}`;
};

const TabularResponse = Schema.Struct({
  tables: Schema.Array(
    Schema.Struct({
      fields: Schema.Array(Schema.Struct({ name: Schema.String })),
      columns: Schema.Array(Schema.Array(Schema.Unknown)),
    }),
  ),
});

/**
 * Axiom serializes timespans as nanoseconds; the string branch keeps the
 * parser usable against the UI's unit-suffixed form.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- raw tabular cell, narrowed with Predicate
const durationToMs = (value: unknown): number | undefined => {
  if (Predicate.isNumber(value)) return value / 1_000_000;
  if (!Predicate.isString(value)) return undefined;
  const match = /^([\d.]+)\s*(ns|µs|us|ms|s)$/.exec(value.trim());
  if (match === null) return undefined;
  const amount = Number(match[1]);
  switch (match[2]) {
    case "ns":
      return amount / 1_000_000;
    case "µs":
    case "us":
      return amount / 1_000;
    case "s":
      return amount * 1_000;
    default:
      return amount;
  }
};

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- raw tabular cell, narrowed with Predicate
const toCount = (value: unknown): number => (Predicate.isNumber(value) ? value : 0);

const columnAccessor = (
  fields: ReadonlyArray<{ readonly name: string }>,
  columns: ReadonlyArray<ReadonlyArray<unknown>>,
): ((name: string, row: number) => unknown) => {
  const indexByName = new Map(fields.map((field, index) => [field.name, index]));
  return (name, row) => {
    const index = indexByName.get(name);
    if (index === undefined) return undefined;
    return columns[index]?.[row];
  };
};

export const parseSpanLatencyResponse = (
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- decoded by Schema at the HTTP boundary
  payload: unknown,
): Effect.Effect<readonly SpanLatency[], PerformanceHarnessError> =>
  Schema.decodeUnknownEffect(TabularResponse)(payload).pipe(
    Effect.mapError(
      (cause) =>
        new PerformanceHarnessError({
          message: "Unexpected Axiom tabular response shape",
          cause,
        }),
    ),
    Effect.map((response) => {
      const table = response.tables[0];
      if (table === undefined) return [];
      const value = columnAccessor(table.fields, table.columns);
      const rowCount = table.columns[0]?.length ?? 0;
      return Array.from({ length: rowCount }, (_, row) => ({
        service: String(value("service.name", row) ?? ""),
        operation: String(value("name", row) ?? ""),
        count: toCount(value("count", row)),
        p50Ms: durationToMs(value("p50", row)),
        p95Ms: durationToMs(value("p95", row)),
      }));
    }),
  );

export type QuerySpanLatenciesOptions = SpanLatencyQueryOptions & {
  readonly token: string;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly fetchImpl: FetchLike;
};

export const querySpanLatencies = (
  options: QuerySpanLatenciesOptions,
): Effect.Effect<readonly SpanLatency[], PerformanceHarnessError> =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () =>
        options.fetchImpl(AXIOM_QUERY_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            apl: buildSpanLatencyQuery(options),
            startTime: options.startedAt.toISOString(),
            endTime: options.finishedAt.toISOString(),
          }),
        }),
      catch: (cause) =>
        new PerformanceHarnessError({
          message: "Axiom query request failed",
          cause,
        }),
    });
    if (!response.ok) {
      return yield* new PerformanceHarnessError({
        message: `Axiom query returned HTTP ${response.status}`,
      });
    }
    const payload = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (cause) =>
        new PerformanceHarnessError({
          message: "Axiom query response was not JSON",
          cause,
        }),
    });
    return yield* parseSpanLatencyResponse(payload);
  });

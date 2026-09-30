import { appendFile, writeFile } from "node:fs/promises";
import { Effect } from "effect";
import { PerformanceHarnessError } from "@tom/types/errors";
import { renderMarkdown } from "./compare.ts";
import { collectPerformance } from "./run.ts";

const requiredEnv = (name: string): Effect.Effect<string, PerformanceHarnessError> => {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return Effect.fail(
      new PerformanceHarnessError({ message: `Missing required env var ${name}` }),
    );
  }
  return Effect.succeed(value);
};

const optionalPositiveInteger = (name: string): number | undefined => {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const candidateStage = (): Effect.Effect<string, PerformanceHarnessError> => {
  const explicit = process.env.PERF_CANDIDATE_STAGE;
  if (explicit !== undefined && explicit !== "") return Effect.succeed(explicit);
  const pullRequest = process.env.PULL_REQUEST;
  if (pullRequest !== undefined && pullRequest !== "") return Effect.succeed(`pr-${pullRequest}`);
  return Effect.fail(
    new PerformanceHarnessError({
      message: "Set PERF_CANDIDATE_STAGE (or PULL_REQUEST for a pr-<n> stage)",
    }),
  );
};

const program = Effect.gen(function* () {
  const stage = yield* candidateStage();
  const baselineStage = process.env.PERF_BASELINE_STAGE ?? "staging";
  const accountId = yield* requiredEnv("CLOUDFLARE_ACCOUNT_ID");
  // An unset GitHub secret arrives as an empty string, so `||` is the fallback.
  const analyticsToken =
    process.env.CLOUDFLARE_ANALYTICS_TOKEN || (yield* requiredEnv("CLOUDFLARE_API_TOKEN"));
  const rounds = optionalPositiveInteger("PERF_ROUNDS");
  const warmupRounds = optionalPositiveInteger("PERF_WARMUP_ROUNDS");

  const comparison = yield* collectPerformance({
    candidateStage: stage,
    baselineStage,
    accountId,
    analyticsToken,
    ...(process.env.PERF_PROBE_TOKEN && { probeToken: process.env.PERF_PROBE_TOKEN }),
    ...(process.env.AXIOM_QUERY_TOKEN && { axiomToken: process.env.AXIOM_QUERY_TOKEN }),
    ...(process.env.AXIOM_TRACES_DATASET && { axiomDataset: process.env.AXIOM_TRACES_DATASET }),
    ...(rounds !== undefined && { rounds }),
    ...(warmupRounds !== undefined && { warmupRounds }),
  });

  const markdown = renderMarkdown(comparison);
  yield* Effect.logInfo(markdown);

  const reportPath = process.env.PERF_REPORT_PATH ?? "perf-report.json";
  yield* Effect.tryPromise({
    try: () => writeFile(reportPath, `${JSON.stringify(comparison, null, 2)}\n`),
    catch: (cause) =>
      new PerformanceHarnessError({ message: `Could not write ${reportPath}`, cause }),
  });

  const markdownPath = process.env.PERF_MARKDOWN_PATH ?? "perf-report.md";
  yield* Effect.tryPromise({
    try: () => writeFile(markdownPath, `${markdown}\n`),
    catch: (cause) =>
      new PerformanceHarnessError({ message: `Could not write ${markdownPath}`, cause }),
  });

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath !== undefined && summaryPath !== "") {
    yield* Effect.tryPromise({
      try: () => appendFile(summaryPath, `${markdown}\n`),
      catch: (cause) =>
        new PerformanceHarnessError({ message: "Could not append the job summary", cause }),
    });
  }

  const failOnRegression = process.env.PERF_FAIL_ON_REGRESSION === "1";
  if (failOnRegression && comparison.verdict === "fail") {
    return yield* new PerformanceHarnessError({
      message: `Performance regression: ${comparison.candidateStage} vs ${comparison.baselineStage}`,
    });
  }
  return comparison;
});

Effect.runPromise(program.pipe(Effect.tapError((error) => Effect.logError(error.message)))).catch(
  () => {
    process.exitCode = 1;
  },
);

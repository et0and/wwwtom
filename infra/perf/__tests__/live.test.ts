import { describe, expect } from "vitest";
import { Effect } from "effect";
import { make } from "alchemy/Test/Vitest";
import * as Cloudflare from "alchemy/Cloudflare";
import { PerformanceHarnessError } from "@tom/types/errors";
import sharedStack from "../../shared.run.ts";
import apiStack from "../../apps/api.run.ts";
import adapterStack from "../../apps/adapter.run.ts";
import webStack from "../../apps/web.run.ts";
import { collectPerformance } from "../run.ts";

/**
 * Live harness run with the Alchemy Test API: deploy candidate stacks to an
 * isolated `perf-*` stage, measure them against the `staging` baseline, then
 * destroy them. Opt-in because it provisions real Cloudflare resources:
 *
 *   PERF_LIVE=1 ALCHEMY_TEST_STAGE=perf-local \
 *     pnpm --filter @tom/infra perf:live
 *
 * The `perf-` stage prefix is required for OTLP telemetry (otelEnabledStages);
 * the run also needs CLOUDFLARE_ACCOUNT_ID and an analytics token, and needs
 * AXIOM_QUERY_TOKEN for span latency.
 */
const stage = process.env.ALCHEMY_TEST_STAGE ?? "perf-local";
const live = process.env.PERF_LIVE === "1";

describe.skipIf(!live)("perf live run", () => {
  const test = make({
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
    stage,
  });

  const deployAll = Effect.gen(function* () {
    yield* test.deploy(sharedStack);
    yield* test.deploy(apiStack);
    yield* test.deploy(adapterStack);
    yield* test.deploy(webStack);
  });

  const destroyAll = Effect.gen(function* () {
    yield* test.destroy(webStack).pipe(Effect.ignore);
    yield* test.destroy(adapterStack).pipe(Effect.ignore);
    yield* test.destroy(apiStack).pipe(Effect.ignore);
    yield* test.destroy(sharedStack).pipe(Effect.ignore);
  });

  // beforeAll registers the hook and returns an accessor for its result;
  // the deploy has no outputs to read, so discard it explicitly.
  void test.beforeAll(deployAll, { timeout: 45 * 60_000 });

  test.afterAll(destroyAll, { timeout: 45 * 60_000 });

  test.test(
    "measures the candidate stage against staging",
    Effect.gen(function* () {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
      const analyticsToken =
        process.env.CLOUDFLARE_ANALYTICS_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN;
      if (!accountId || !analyticsToken) {
        return yield* new PerformanceHarnessError({
          message: "Live perf runs need CLOUDFLARE_ACCOUNT_ID and an analytics token",
        });
      }

      const comparison = yield* collectPerformance({
        candidateStage: stage,
        baselineStage: process.env.PERF_BASELINE_STAGE ?? "staging",
        accountId,
        analyticsToken,
        ...(process.env.PERF_PROBE_TOKEN && { probeToken: process.env.PERF_PROBE_TOKEN }),
        ...(process.env.AXIOM_QUERY_TOKEN && { axiomToken: process.env.AXIOM_QUERY_TOKEN }),
      });

      expect(comparison.metrics.length).toBeGreaterThan(0);
      expect(comparison.probe.candidate.failures).toBe(0);
      expect(comparison.probe.baseline.failures).toBe(0);
    }).pipe(Effect.asVoid),
    { timeout: 30 * 60_000 },
  );
});

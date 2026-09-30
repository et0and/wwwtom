import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import {
  buildWorkersAnalyticsQuery,
  parseWorkersAnalyticsResponse,
  workerScriptNames,
} from "../cloudflare-analytics.ts";

const scripts = workerScriptNames("pr-123");

describe("workerScriptNames", () => {
  it("derives stage-suffixed script names", () => {
    expect(workerScriptNames("pr-123")).toEqual({
      web: "wwwtom-pr-123",
      api: "wwwtom-api-pr-123",
      adapter: "wwwtom-adapter-pr-123",
    });
  });

  it("uses the adopted production names", () => {
    expect(workerScriptNames("production")).toEqual({
      web: "wwwtom",
      api: "apitom",
      adapter: "wwwtom-adapter",
    });
  });
});

describe("buildWorkersAnalyticsQuery", () => {
  it("aliases one invocation node per app with the script filter", () => {
    const query = buildWorkersAnalyticsQuery(scripts);
    expect(query).toContain(
      'web: workersInvocationsAdaptive(limit: 1000, filter: { scriptName: "wwwtom-pr-123"',
    );
    expect(query).toContain(
      'api: workersInvocationsAdaptive(limit: 1000, filter: { scriptName: "wwwtom-api-pr-123"',
    );
    expect(query).toContain("sum { requests errors subrequests cpuTimeUs }");
    expect(query).toContain("quantiles { cpuTimeP50 cpuTimeP99 wallTimeP50 wallTimeP99 }");
  });
});

describe("parseWorkersAnalyticsResponse", () => {
  it("sums adaptive rows and keeps the worst-minute quantiles", async () => {
    const metrics = await Effect.runPromise(
      parseWorkersAnalyticsResponse(scripts, {
        data: {
          viewer: {
            accounts: [
              {
                api: [
                  {
                    sum: { requests: 2, errors: 0, subrequests: 1, cpuTimeUs: 1000 },
                    quantiles: {
                      cpuTimeP50: 100,
                      cpuTimeP99: 300,
                      wallTimeP50: 10,
                      wallTimeP99: 20,
                    },
                  },
                  {
                    sum: { requests: 3, errors: 1, subrequests: 2, cpuTimeUs: 3000 },
                    quantiles: {
                      cpuTimeP50: 200,
                      cpuTimeP99: 500,
                      wallTimeP50: 15,
                      wallTimeP99: 25,
                    },
                  },
                ],
              },
            ],
          },
        },
      }),
    );
    expect(metrics).toContainEqual({
      app: "api",
      scriptName: "wwwtom-api-pr-123",
      requests: 5,
      errors: 1,
      subrequests: 3,
      cpuTimeUs: 4000,
      cpuTimeP50Us: 200,
      cpuTimeP99Us: 500,
      wallTimeP50Ms: 15,
      wallTimeP99Ms: 25,
    });
    expect(metrics).toContainEqual(
      expect.objectContaining({ app: "web", requests: 0, cpuTimeP99Us: undefined }),
    );
  });

  it("fails with a harness error on GraphQL errors", async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        parseWorkersAnalyticsResponse(scripts, { errors: [{ message: "invalid token" }] }),
      ),
    );
    expect(error._tag).toBe("PerformanceHarnessError");
    expect(error.message).toContain("invalid token");
  });
});

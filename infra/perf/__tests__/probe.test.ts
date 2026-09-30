import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import {
  PROBE_HEADER,
  expectProbeReachable,
  probeRequests,
  runProbe,
  runProbeRequest,
  summarizeProbe,
  type FetchLike,
} from "../probe.ts";

const request = (url: string) => ({ app: "api" as const, name: "health", url });

const okFetch: FetchLike = async () => new Response("ok", { status: 200 });

describe("probeRequests", () => {
  it("targets the stage web, api, and adapter hosts", () => {
    const urls = probeRequests("pr-123").map((probe) => probe.url);
    expect(urls).toEqual([
      "https://pr-123-web.tom.so/",
      "https://pr-123-web.tom.so/posts",
      "https://pr-123-web.tom.so/guestbook",
      "https://pr-123-adapter.tom.so/content/arena/posts",
      "https://pr-123-adapter.tom.so/polar/products",
      "https://pr-123-api.tom.so/health",
    ]);
  });

  it("targets production hosts without a stage prefix", () => {
    const urls = probeRequests("production").map((probe) => probe.url);
    expect(urls).toContain("https://tom.so/");
    expect(urls).toContain("https://api.tom.so/health");
    expect(urls).toContain("https://adapter.tom.so/polar/products");
  });
});

describe("runProbeRequest", () => {
  it("records status and duration on success", async () => {
    const result = await Effect.runPromise(
      runProbeRequest(request("https://example.com/health"), {
        fetchImpl: okFetch,
        probeToken: "secret",
      }),
    );
    expect(result).toMatchObject({ status: 200, app: "api", name: "health" });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  it("records a failure instead of failing the round", async () => {
    const result = await Effect.runPromise(
      runProbeRequest(request("https://example.com/health"), {
        fetchImpl: async () => {
          throw new Error("blocked");
        },
      }),
    );
    expect(result.status).toBe(0);
    expect(result.error).toBe("blocked");
  });

  it("sends the probe header when a token is set", async () => {
    const seenHeaders: Array<HeadersInit | undefined> = [];
    const captureFetch: FetchLike = async (_input, init) => {
      seenHeaders.push(init?.headers);
      return new Response("ok", { status: 200 });
    };
    await Effect.runPromise(
      runProbeRequest(request("https://example.com/health"), {
        fetchImpl: captureFetch,
        probeToken: "secret",
      }),
    );
    expect(new Headers(seenHeaders[0]).get(PROBE_HEADER)).toBe("secret");
  });
});

describe("runProbe", () => {
  it("discards warmup rounds and summarizes measured rounds", async () => {
    const calls = { count: 0 };
    const countingFetch: FetchLike = async () => {
      calls.count += 1;
      return new Response("ok", { status: 200 });
    };
    const probe = await Effect.runPromise(
      runProbe("pr-123", {
        fetchImpl: countingFetch,
        rounds: 2,
        warmupRounds: 1,
      }),
    );
    const perRound = probeRequests("pr-123").length;
    expect(calls.count).toBe(perRound * 3);
    expect(probe.rounds).toHaveLength(2);
    expect(summarizeProbe(probe)).toMatchObject({ requests: perRound * 2, failures: 0 });
  });
});

describe("expectProbeReachable", () => {
  const failingFetch: FetchLike = async () => {
    throw new Error("down");
  };

  it("passes when enough requests succeeded", async () => {
    const probe = await Effect.runPromise(
      runProbe("pr-123", { fetchImpl: okFetch, rounds: 1, warmupRounds: 0 }),
    );
    await expect(Effect.runPromise(expectProbeReachable(probe))).resolves.toBeUndefined();
  });

  it("fails with a harness error when the stage is unreachable", async () => {
    const probe = await Effect.runPromise(
      runProbe("pr-123", { fetchImpl: failingFetch, rounds: 1, warmupRounds: 0 }),
    );
    const error = await Effect.runPromise(Effect.flip(expectProbeReachable(probe)));
    expect(error._tag).toBe("PerformanceHarnessError");
    expect(error.message).toContain("pr-123");
  });
});

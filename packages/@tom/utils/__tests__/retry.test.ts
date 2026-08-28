import { describe, expect, it } from "@effect/vitest";
import { Effect, Schedule } from "effect";
import { retryPolicy } from "../src/retry";

describe("retryPolicy", () => {
  it("is a defined Schedule", () => {
    expect(retryPolicy).toBeDefined();
  });

  it.live("uses max delays not min (exponential backoff)", () =>
    Effect.gen(function* () {
      const start = Date.now();
      yield* Effect.fail(new Error("fail")).pipe(
        Effect.retry(retryPolicy),
        Effect.catch(() => Effect.void),
      );
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(200);
    }),
  );

  it.live("can be used as a retry schedule for a failing effect", () =>
    Effect.gen(function* () {
      let attempts = 0;
      const effect = Effect.gen(function* () {
        attempts += 1;
        if (attempts < 2) return yield* Effect.fail(new Error("transient"));
        return "ok" as const;
      }).pipe(Effect.retry(retryPolicy));

      const result = yield* effect;
      expect(result).toBe("ok");
      expect(attempts).toBe(2);
    }),
  );

  it.live("stops retrying after the recurrence limit", () =>
    Effect.gen(function* () {
      let attempts = 0;
      const alwaysFails = Effect.gen(function* () {
        attempts += 1;
        return yield* Effect.fail(new Error("always fails"));
      }).pipe(Effect.retry(retryPolicy));

      const exit = yield* Effect.exit(alwaysFails);
      expect(exit._tag).toBe("Failure");
      expect(attempts).toBe(4);
    }),
  );

  it.live("applies exponential delays via max composition", () =>
    Effect.gen(function* () {
      const start = Date.now();
      yield* Effect.fail(new Error("fail")).pipe(
        Effect.retry(Schedule.max([Schedule.exponential(10), Schedule.recurs(1)])),
        Effect.catch(() => Effect.void),
      );
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(5);
    }),
  );
});

import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { retryPolicy } from "../src/retry";

describe("retryPolicy", () => {
  it("retries fetch errors three times", async () => {
    const attempts: Array<number> = [];
    const program = Effect.gen(function* () {
      attempts.push(1);
      if (attempts.length < 4) {
        return yield* Effect.fail(new Error("boom"));
      }
      return "ok";
    }).pipe(Effect.retry(retryPolicy));
    const result = await Effect.runPromise(program);
    expect(result).toBe("ok");
    expect(attempts).toHaveLength(4);
  }, 10_000);

  it("fails after four attempts if always failing", async () => {
    const attempts: Array<number> = [];
    const program = Effect.gen(function* () {
      attempts.push(1);
      return yield* Effect.fail(new Error("boom"));
    }).pipe(Effect.retry(retryPolicy));
    const result = await Effect.runPromise(Effect.flip(program));
    expect(result.message).toBe("boom");
    expect(attempts).toHaveLength(4);
  }, 10_000);
});

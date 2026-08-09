import { Effect } from "effect";
import type { KvNamespaceLike } from "@tom/utils/services/config";

const RATE_LIMIT = 60;
const WINDOW_MS = 60_000;
const WINDOW_TTL_SECONDS = 120;

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly retryAfter?: number;
}

export interface RateLimiterService {
  readonly checkLimit: (key: string) => Effect.Effect<RateLimitResult, never>;
}

const failOpen: RateLimitResult = { allowed: true };

export const makeRateLimiter = (kv: KvNamespaceLike | undefined): RateLimiterService => ({
  checkLimit: (key) =>
    Effect.tryPromise(async () => {
      const now = Date.now();
      const windowKey = `${key}:${Math.floor(now / WINDOW_MS)}`;
      const current = kv ? await kv.get(windowKey) : null;
      const count = Number(current ?? 0) || 0;

      if (count >= RATE_LIMIT) {
        return {
          allowed: false,
          retryAfter: Math.ceil((WINDOW_MS - (now % WINDOW_MS)) / 1000),
        };
      }

      await kv?.put(windowKey, String(count + 1), { expirationTtl: WINDOW_TTL_SECONDS });
      return failOpen;
    }).pipe(Effect.catch(() => Effect.succeed(failOpen))),
});

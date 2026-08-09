import { Effect } from "effect";
import type { KvNamespaceLike } from "@tom/utils/services/config";

const BAN_PREFIX = "banned";
const STRIKE_PREFIX = "strikes";
const POW_PREFIX = "pow";
const CHALLENGE_PREFIX = "challenge";
const BAN_THRESHOLD = 50;
const STRIKE_TTL_SECONDS = 86400;

const key = (prefix: string, value: string): string => `${prefix}:${value}`;

export interface AbuseService {
  readonly isBanned: (ip: string) => Effect.Effect<boolean, never>;
  readonly isPowReplay: (token: string) => Effect.Effect<boolean, never>;
  readonly markPowUsed: (token: string) => Effect.Effect<void, never>;
  readonly recordStrike: (ip: string) => Effect.Effect<void, never>;
  readonly saveChallenge: (challengeId: string, difficulty: number) => Effect.Effect<void, never>;
  readonly getChallengeDifficulty: (challengeId: string) => Effect.Effect<number | null, never>;
}

const kvGet = (kv: KvNamespaceLike | undefined, k: string): Promise<string | null> =>
  kv ? kv.get(k) : Promise.resolve(null);

const kvPut = (
  kv: KvNamespaceLike | undefined,
  k: string,
  value: string,
  options?: { readonly expirationTtl?: number },
): Promise<void> => (kv ? kv.put(k, value, options) : Promise.resolve());

export const makeAbuseService = (kv: KvNamespaceLike | undefined): AbuseService => ({
  isBanned: (ip) =>
    Effect.tryPromise(() => kvGet(kv, key(BAN_PREFIX, ip))).pipe(
      Effect.catch(() => Effect.succeed(null)),
      Effect.map((result) => result !== null),
    ),

  isPowReplay: (token) =>
    Effect.tryPromise(() => kvGet(kv, key(POW_PREFIX, token))).pipe(
      Effect.catch(() => Effect.succeed(null)),
      Effect.map((result) => result !== null),
    ),

  markPowUsed: (token) =>
    Effect.tryPromise(() => kvPut(kv, key(POW_PREFIX, token), "1", { expirationTtl: 86400 })).pipe(
      Effect.catch(() => Effect.void),
    ),

  recordStrike: (ip) =>
    Effect.tryPromise(async () => {
      const strikeKey = key(STRIKE_PREFIX, ip);
      const current = await kvGet(kv, strikeKey);
      const next = (Number(current ?? 0) || 0) + 1;
      await kvPut(kv, strikeKey, String(next), { expirationTtl: STRIKE_TTL_SECONDS });

      if (next >= BAN_THRESHOLD) {
        await kvPut(kv, key(BAN_PREFIX, ip), "1");
      }
    }).pipe(Effect.catch(() => Effect.void)),

  saveChallenge: (challengeId, difficulty) =>
    Effect.tryPromise(() =>
      kvPut(kv, key(CHALLENGE_PREFIX, challengeId), String(difficulty), { expirationTtl: 3600 }),
    ).pipe(Effect.catch(() => Effect.void)),

  getChallengeDifficulty: (challengeId) =>
    Effect.tryPromise(() => kvGet(kv, key(CHALLENGE_PREFIX, challengeId))).pipe(
      Effect.catch(() => Effect.succeed(null)),
      Effect.map((result) => (result === null ? null : Number(result) || null)),
    ),
});

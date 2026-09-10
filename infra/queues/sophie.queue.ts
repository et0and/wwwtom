import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { Stage } from "alchemy/Stage";

/**
 * The Sophie-tenant work queue. The Sophie adapter binds it as
 * `WORK_QUEUE` and the Sophie api worker hosts its single consumer (see
 * infra/apps/api.run.ts) — the same split as the Tom queue (see
 * {@link tomQueue} in tom.queue.ts), so Tom jobs can never reach the
 * Sophie consumer and vice versa.
 *
 * Lifecycle: the api stack owns the queue (no retain there) while the
 * adapter stack keeps a retained copy. Destroy runs adapter before api
 * (see the root destroy chain), so no worker still references the queue
 * when the api stack tears down and the delete succeeds.
 *
 * Production adopts the plain `sophie-work-queue`; other stages get a
 * deterministic per-stage name so every app stack in a stage binds the
 * same queue.
 */
export const sophieQueue = Effect.gen(function* () {
  const stage = yield* Stage;

  return yield* Cloudflare.Queues.Queue("sophie-work-queue", {
    name: stage === "production" ? "sophie-work-queue" : `sophie-work-queue-${stage}`,
  });
});

/**
 * Dead letter queue for {@link sophieQueue} — messages that exhaust the
 * Sophie consumer's retries are routed here, so nothing is silently
 * dropped.
 */
export const sophieQueueDlq = Effect.gen(function* () {
  const stage = yield* Stage;

  return yield* Cloudflare.Queues.Queue("sophie-work-queue-dlq", {
    name: stage === "production" ? "sophie-work-queue-dlq" : `sophie-work-queue-${stage}-dlq`,
  });
});

import * as Cloudflare from "@alchemy.run/cloudflare";
import { Effect } from "effect";
import { Stage } from "alchemy/Stage";

/**
 * The single tom work queue. The adapter binds it as `WORK_QUEUE` and
 * enqueues a `guestbook-sign` job after a signature is stored; the api worker
 * hosts the single worker consumer (at most one per queue) that drains it and
 * alerts the site owner.
 *
 * The shared stack (`infra/shared.run.ts`) owns the queue's lifecycle — it is
 * destroyed last in every teardown, by which point every worker that binds it
 * is already gone, so the queue can actually be deleted (Cloudflare refuses
 * to delete a queue that a Worker still references, which aborted preview
 * destroys mid-chain and leaked every sibling resource — Hyperdrives
 * included). The app stacks keep their own copies marked `retain()`, so
 * their destroys skip the delete and preview teardown stays convergent.
 *
 * Production adopts the plain `tom-work-queue`; other stages get a
 * deterministic per-stage name so every app stack in a stage binds the same
 * queue (Alchemy's auto-naming would give each stack its own queue, since the
 * generated name is prefixed with the stack name).
 *
 * @example Enqueue work from the adapter guestbook route (producer)
 * ```ts
 * // infra/apps/adapter.run.ts binds WORK_QUEUE: tomQueue into the adapter env.
 * import { makeTomQueueLayer, TomQueueService } from "@tom/utils/queue";
 *
 * const queue = yield* TomQueueService;
 * yield* queue.send({ kind: "guestbook-sign", entryId, ... });
 * ```
 * Message bodies are `TomWorkMessage` (@tom/schemas/queue).
 *
 * @example Drain the queue from the api worker (consumer)
 * ```ts
 * // infra/apps/api.run.ts — the api worker's entry (apps/api/src/index.ts)
 * // exports both `fetch` and `queue`; register the consumer against it.
 * const queue = yield* tomQueue;
 * const dlq = yield* tomQueueDlq;
 * yield* Cloudflare.Queues.Consumer("tom-work-consumer", {
 *   queueId: queue.queueId,
 *   scriptName: worker.workerName,
 *   deadLetterQueue: dlq.queueName,
 *   settings: { batchSize: 10, maxRetries: 3, maxWaitTimeMs: 5000 },
 * });
 * ```
 * `maxRetries` + `retryDelay` give delivery guarantees; messages that still
 * fail land in the dead letter queue (see {@link tomQueueDlq}).
 */
export const tomQueue = Effect.gen(function* () {
  const stage = yield* Stage;

  return yield* Cloudflare.Queues.Queue("tom-work-queue", {
    name: stage === "production" ? "tom-work-queue" : `tom-work-queue-${stage}`,
  });
});

/**
 * Dead letter queue for {@link tomQueue} — messages that exhaust the
 * consumer's retries are routed here, so nothing is silently dropped. Wire it
 * into a Consumer via its `deadLetterQueue` option (pass `dlq.queueName`).
 */
export const tomQueueDlq = Effect.gen(function* () {
  const stage = yield* Stage;

  return yield* Cloudflare.Queues.Queue("tom-work-queue-dlq", {
    name: stage === "production" ? "tom-work-queue-dlq" : `tom-work-queue-${stage}-dlq`,
  });
});

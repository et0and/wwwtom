import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { Stage } from "alchemy/Stage";

/**
 * The single generic tom work queue. Any app worker (web, api, adapter) binds
 * it as `WORK_QUEUE` in its env and enqueues work at runtime; a dedicated
 * consumer worker drains it (at most one worker consumer per queue).
 *
 * Production adopts the plain `tom-work-queue`; other stages get a
 * deterministic per-stage name so every app stack in a stage binds the same
 * queue (Alchemy's auto-naming would give each stack its own queue, since the
 * generated name is prefixed with the stack name).
 *
 * @example Enqueue work from an api route (producer)
 * ```ts
 * // infra/apps/api.run.ts binds WORK_QUEUE: tomQueue into the api worker env.
 * import { Effect } from "effect";
 * import {
 *   getRequestEnv,
 *   logContextFromRequest,
 *   runEffect,
 * } from "@tom/utils/services/worker";
 *
 * const env = getRequestEnv(request);
 * await runEffect(
 *   Effect.tryPromise(() =>
 *     env.WORK_QUEUE!.send({ kind: "publish-post", postId, at: Date.now() }),
 *   ),
 *   logContextFromRequest(request, "tom-api"),
 * );
 * ```
 * Messages can be any JSON-serializable value; `sendBatch` exists for several
 * at once.
 *
 * @example Drain the queue from a consumer worker
 * ```ts
 * // infra/apps/worker.run.ts — register the consumer against a worker whose
 * // entry exports a `queue` handler.
 * const worker = yield* Cloudflare.Worker("wwwtom-worker", {
 *   main: `${rootDir}/apps/worker/src/index.ts`,
 * });
 * const dlq = yield* tomQueueDlq;
 * yield* Cloudflare.Queues.Consumer("tom-work-consumer", {
 *   queueId: queue.queueId,
 *   scriptName: worker.workerName,
 *   deadLetterQueue: dlq.queueName,
 *   settings: { batchSize: 10, maxRetries: 3, maxWaitTimeMs: 5000 },
 * });
 * ```
 * ```ts
 * // apps/worker/src/index.ts — message bodies arrive parsed (json default).
 * export default {
 *   queue: async (batch) => {
 *     for (const message of batch.messages) {
 *       await handleJob(message.body);
 *     }
 *   },
 * };
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

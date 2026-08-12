import { Context, Effect, Layer } from "effect";
import type { TomWorkMessageEncoded } from "@tom/schemas/queue";
import { QueueError } from "@tom/types/errors";
import type { CloudflareEnv } from "./config";

export interface TomQueueServiceShape {
  readonly send: (
    message: TomWorkMessageEncoded,
  ) => Effect.Effect<void, QueueError>;
  readonly sendBatch: (
    messages: ReadonlyArray<TomWorkMessageEncoded>,
  ) => Effect.Effect<void, QueueError>;
}

export class TomQueueService extends Context.Service<
  TomQueueService,
  TomQueueServiceShape
>()("TomQueueService") {}

const sendToQueue = (
  env: CloudflareEnv,
  operation: (queue: NonNullable<CloudflareEnv["WORK_QUEUE"]>) => Promise<void>,
): Effect.Effect<void, QueueError> => {
  const queue = env.WORK_QUEUE;
  if (!queue) {
    return Effect.fail(
      new QueueError({ message: "WORK_QUEUE binding missing from worker env" }),
    );
  }
  return Effect.tryPromise({
    try: () => operation(queue),
    catch: (cause) =>
      new QueueError({ message: "Failed to send to tom work queue", cause }),
  });
};

/**
 * Build the queue service from a request's env. Bindings are per-request in
 * the Elysia workers (see `attachRequestEnv`/`getRequestEnv`), so construct
 * this layer in a handler and provide it around the effect that uses
 * {@link TomQueueService}.
 */
export const makeTomQueueLayer = (
  env: CloudflareEnv,
): Layer.Layer<TomQueueService> =>
  Layer.succeed(TomQueueService, {
    send: Effect.fn("TomQueueService.send")(
      (message: TomWorkMessageEncoded) =>
        sendToQueue(env, (queue) => queue.send(message)),
    ),
    sendBatch: Effect.fn("TomQueueService.sendBatch")(
      (messages: ReadonlyArray<TomWorkMessageEncoded>) =>
        sendToQueue(env, (queue) =>
          queue.sendBatch(messages.map((body) => ({ body }))),
        ),
    ),
  });

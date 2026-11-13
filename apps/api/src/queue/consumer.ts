import { Effect, Layer, Schema } from "effect";
import { TomWorkMessage } from "@tom/schemas/queue";
import type { TelegramError } from "@tom/types/errors";
import { makeAppConfigLayer, readCloudflareEnv, type CloudflareEnv } from "@tom/utils/config";
import {
  logLevelFromEnv,
  otelConfigFromResolvedEnv,
  withLogging,
  type LogContext,
} from "@tom/utils/logging";
import { TelegramService } from "@tom/utils/telegram";

// Structural subset of the queue event the runtime delivers; the Worker
// entry needs no full @cloudflare/workers-types dependency. `ack`/`retry`
// settle one message so a failure never re-runs its batch neighbours.
type QueueMessage = {
  readonly id: string;
  readonly body: unknown;
  readonly ack: () => void;
  readonly retry: () => void;
};
export type MessageBatch = { readonly messages: readonly QueueMessage[] };

/**
 * Markdown alert for the site owner, sent off the sign request path so the
 * response never waits on Telegram.
 */
export const buildGuestbookSignAlert = (message: TomWorkMessage): string =>
  [
    "*New guestbook signature*",
    "",
    `*From:* @${message.fediverseUsername} (${message.displayName})`,
    `*Message:* ${message.message}`,
  ].join("\n");

const handleGuestbookSign = Effect.fn("api.queue.guestbook-sign")((message: TomWorkMessage) =>
  Effect.gen(function* () {
    const telegram = yield* TelegramService;
    yield* telegram.sendAlert(buildGuestbookSignAlert(message));
  }),
);

/**
 * Dispatch one decoded queue message. Handler errors propagate to the batch
 * loop, which retries only that message; exhausted messages land in the DLQ.
 */
export const processMessage = (
  message: TomWorkMessage,
): Effect.Effect<void, TelegramError, TelegramService> =>
  Effect.gen(function* () {
    yield* Effect.logInfo("api:queue:process", { kind: message.kind });
    yield* handleGuestbookSign(message);
  });

const telegramLayer = (env: CloudflareEnv) => {
  const configLayer = makeAppConfigLayer({
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: env.TELEGRAM_CHAT_ID,
  });
  return Layer.provide(TelegramService.Default, configLayer);
};

/**
 * The tom work queue consumer, hosted by the api worker (the script serves
 * HTTP and drains the queue; both handlers coexist). Each body arrives as
 * unknown JSON — decode at the boundary with TomWorkMessage. A message that
 * decodes and succeeds is acked; one that fails is retried on its own, so an
 * earlier message's Telegram alert never repeats because a later job in the
 * same batch failed. Exhausted messages land in the DLQ
 * (tom-work-queue-dlq).
 */
export const queueHandler = async (batch: MessageBatch, env: CloudflareEnv): Promise<void> => {
  const resolved = await readCloudflareEnv(env);
  const otel = otelConfigFromResolvedEnv(resolved);
  const context: LogContext = {
    serviceName: "tom-api",
    logLevel: logLevelFromEnv(resolved),
    ...(otel && { otel }),
  };
  await Effect.runPromise(
    withLogging(
      Effect.gen(function* () {
        for (const message of batch.messages) {
          yield* Schema.decodeUnknownEffect(TomWorkMessage)(message.body).pipe(
            Effect.flatMap(processMessage),
            Effect.tap(() => Effect.sync(() => message.ack())),
            Effect.catch((cause) =>
              Effect.gen(function* () {
                yield* Effect.logError("api:queue:message-failed", {
                  messageId: message.id,
                  cause: String(cause),
                });
                yield* Effect.sync(() => message.retry());
              }),
            ),
          );
        }
      }).pipe(Effect.provide(telegramLayer(resolved))),
      context,
    ),
  );
};

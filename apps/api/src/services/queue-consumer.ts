import { Effect, Layer, Schema } from "effect";
import { TomWorkMessage } from "@tom/schemas/queue";
import type { TelegramError } from "@tom/types/errors";
import { makeAppConfigLayer, readCloudflareEnv } from "@tom/utils/services/config";
import type { CloudflareEnv } from "@tom/utils/services/config";
import {
  logLevelFromEnv,
  otelConfigFromResolvedEnv,
  withLogging,
} from "@tom/utils/services/logging";
import type { LogContext } from "@tom/utils/services/logging";
import { TelegramService } from "@tom/utils/telegram";

export type GuestbookSignMessage = Extract<TomWorkMessage, { kind: "guestbook-sign" }>;

// Structural subset of the queue event the runtime delivers; the Worker
// entry needs no full @cloudflare/workers-types dependency.
type QueueMessage = { readonly id: string; readonly body: unknown };
export type MessageBatch = { readonly messages: readonly QueueMessage[] };

/**
 * Markdown alert for the site owner, sent off the sign request path so the
 * response never waits on Telegram.
 */
export const buildGuestbookSignAlert = (message: GuestbookSignMessage): string =>
  [
    "*New guestbook signature*",
    "",
    `*From:* @${message.fediverseUsername} (${message.displayName})`,
    `*Message:* ${message.message}`,
  ].join("\n");

const handleGuestbookSign = Effect.fn("api.queue.guestbook-sign")((message: GuestbookSignMessage) =>
  Effect.gen(function* () {
    const telegram = yield* TelegramService;
    yield* telegram.sendAlert(buildGuestbookSignAlert(message));
  }),
);

/**
 * Dispatch one decoded queue message. Handler errors propagate so Cloudflare
 * Queues retries the batch and exhausted messages land in the DLQ.
 */
export const processMessage = (
  message: TomWorkMessage,
): Effect.Effect<void, TelegramError, TelegramService> =>
  Effect.gen(function* () {
    yield* Effect.logInfo("api:queue:process", { kind: message.kind });
    if (message.kind === "guestbook-sign") {
      yield* handleGuestbookSign(message);
    } else {
      // publish-post / render-og are not produced yet; ack with a warning
      // rather than poisoning the queue.
      yield* Effect.logWarning("api:queue:unhandled-kind", { kind: message.kind });
    }
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
 * unknown JSON — decode at the boundary with TomWorkMessage, then let
 * processMessage fail loudly on any handler error so Cloudflare retries the
 * batch and exhausted messages land in the DLQ (tom-work-queue-dlq).
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
          const job = yield* Schema.decodeUnknownEffect(TomWorkMessage)(message.body);
          yield* processMessage(job);
        }
      }).pipe(Effect.provide(telegramLayer(resolved))),
      context,
    ),
  );
};

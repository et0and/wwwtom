import { Effect, Redacted } from "effect";
import { TelegramError } from "@tom/types";
import { AppConfig } from "./services/config";

export interface TelegramServiceShape {
  readonly sendAlert: (message: string) => Effect.Effect<void, TelegramError>;
  readonly sendError: (message: string, error?: unknown) => Effect.Effect<void, TelegramError>;
}

export class TelegramService extends Effect.Service<TelegramService>()("TelegramService", {
  accessors: true,
  dependencies: [AppConfig.Default],
  effect: Effect.gen(function* () {
    const config = yield* AppConfig;

    // Return no-op service if not configured
    if (!config.telegramBotToken || !config.telegramChatId) {
      return {
        sendAlert: Effect.fn("TelegramService.sendAlert")(function* () {
          // no-op
        }),
        sendError: Effect.fn("TelegramService.sendError")(function* () {
          // no-op
        }),
      };
    }

    const token = Redacted.value(config.telegramBotToken);
    const chatId = config.telegramChatId;

    const formatErrorMessage = (level: string, message: string, error?: unknown): string => {
      const timestamp = new Date().toISOString();
      let text = `*${level}*\n\n`;
      text += `*Time:* ${timestamp}\n`;
      text += `*Message:* ${message}`;

      if (error) {
        const errorStr = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        text += `\n\n*Error:* \`${errorStr}\``;
        if (stack) {
          text += `\n\n*Stack:* \n\`\`\`\n${stack}\n\`\`\``;
        }
      }

      return text;
    };

    const doSendTelegramAlert = (text: string): Effect.Effect<void, TelegramError> =>
      Effect.gen(function* () {
        const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;

        const response = yield* Effect.tryPromise({
          try: () =>
            fetch(telegramUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: "Markdown",
              }),
            }),
          catch: (error) =>
            new TelegramError({
              message: error instanceof Error ? error.message : "Unknown error",
            }),
        });

        if (!response.ok) {
          return yield* Effect.fail(
            new TelegramError({
              message: `Telegram API error: ${response.status} ${response.statusText}`,
              status: response.status,
            }),
          );
        }
      });

    return {
      sendAlert: Effect.fn("TelegramService.sendAlert")((message: string) =>
        doSendTelegramAlert(message),
      ),
      sendError: Effect.fn("TelegramService.sendError")((message: string, error?: unknown) =>
        doSendTelegramAlert(formatErrorMessage("ERROR", message, error)),
      ),
    };
  }),
}) {}

import { Effect } from "effect";
import { TelegramError } from "@tom/types";
import { logger } from "./logger";

export interface TelegramBindings {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

let telegramBindings: TelegramBindings | null = null;

export const initTelegram = (b: TelegramBindings) => {
  telegramBindings = b;
};

const isConfigured = (): boolean => {
  return !!(telegramBindings?.TELEGRAM_BOT_TOKEN && telegramBindings?.TELEGRAM_CHAT_ID);
};

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

const doSendTelegramAlert = (text: string): Effect.Effect<void, TelegramError> => {
  return Effect.gen(function* () {
    const bindings = telegramBindings;
    if (!isConfigured() || !bindings) {
      return yield* Effect.fail(new TelegramError({ message: "Telegram not configured" }));
    }

    const telegramUrl = `https://api.telegram.org/bot${bindings.TELEGRAM_BOT_TOKEN}/sendMessage`;

    const response = yield* Effect.tryPromise({
      try: () => {
        return fetch(telegramUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: bindings.TELEGRAM_CHAT_ID,
            text,
            parse_mode: "Markdown",
          }),
        });
      },
      catch: (error) => {
        return new TelegramError({
          message: error instanceof Error ? error.message : "Unknown error",
        });
      },
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
};

export const sendTelegramAlert = async (message: string): Promise<boolean> => {
  const result = await Effect.runPromise(
    doSendTelegramAlert(message).pipe(
      Effect.as(true),
      Effect.catchAll(() => Effect.succeed(false)),
    ),
  );
  return result;
};

export const telegramAlert = {
  error: async (message: string, error?: unknown): Promise<void> => {
    if (isConfigured()) {
      const formatted = formatErrorMessage("ERROR", message, error);
      await Effect.runPromise(
        doSendTelegramAlert(formatted).pipe(
          Effect.tap(() => Effect.sync(() => logger.info("Alert sent successfully"))),
          Effect.catchAll((e) => {
            logger.error("Alert send failed:", e);
            return Effect.void;
          }),
        ),
      );
    }
  },

  send: sendTelegramAlert,
};

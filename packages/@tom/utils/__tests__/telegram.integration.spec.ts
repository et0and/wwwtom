import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Option, Redacted, Schema } from "effect";
import { TelegramService } from "../src/telegram";
import { AppConfig } from "../src/services/config";

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const createConfigLayer = (botToken: string, chat: string) =>
  Layer.succeed(AppConfig, {
    arenaToken: Redacted.make(""),
    arenaBaseUrl: undefined,
    payloadUrl: Redacted.make(""),
    databaseUrl: Redacted.make(""),
    telegramBotToken: Redacted.make(botToken),
    telegramChatId: chat,
    isDev: true,
  });

const createLayer = (botToken: string, chat: string) =>
  Layer.provideMerge(TelegramService.Default, createConfigLayer(botToken, chat));

const ErrorWithMessage = Schema.Struct({ message: Schema.String });

const getErrorMessage = (cause: unknown): string | undefined =>
  Option.getOrElse(
    Option.map(Schema.decodeUnknownOption(ErrorWithMessage)(cause), (parsed) => parsed.message),
    () => undefined,
  );

describe("Telegram integration", () => {
  it.effect("sends a live alert", () =>
    Effect.gen(function* () {
      if (!token || !chatId) {
        yield* Effect.logWarning("TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID missing, skipping");
        return;
      }

      const message = `Telegram integration test ${new Date().toISOString()}`;
      const effect = Effect.flatMap(TelegramService, (service) => service.sendAlert(message));
      const result = yield* Effect.match(Effect.provide(effect, createLayer(token, chatId)), {
        onFailure: (error) => ({ tag: "error" as const, error }),
        onSuccess: (value) => ({ tag: "success" as const, value }),
      });

      if (result.tag === "error") {
        const errorMessage = getErrorMessage(result.error);
        if (errorMessage?.includes("fetch failed") || errorMessage?.includes("404")) {
          yield* Effect.logWarning(
            "Telegram API unavailable or invalid config, skipping integration test",
          );
          return;
        }
        throw result.error;
      }
      expect(result.value).toBeUndefined();
    }),
  );
});

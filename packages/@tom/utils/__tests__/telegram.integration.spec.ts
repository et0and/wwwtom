import { describe, expect, it } from "vitest";
import { Effect, Layer, Redacted } from "effect";
import { TelegramService, TelegramServiceLive } from "../src/telegram";
import { AppConfig } from "../src/services/config";

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const createConfigLayer = (botToken: string, chat: string) =>
  Layer.succeed(AppConfig, {
    arenaToken: Redacted.make(""),
    payloadUrl: Redacted.make(""),
    databaseUrl: Redacted.make(""),
    telegramBotToken: Redacted.make(botToken),
    telegramChatId: chat,
    isDev: true,
  });

const createLayer = (botToken: string, chat: string) =>
  Layer.provideMerge(TelegramServiceLive, createConfigLayer(botToken, chat));

const runTestResult = <A, E>(
  effect: Effect.Effect<A, E, TelegramService>,
  botToken: string,
  chat: string,
): Promise<
  | {
      tag: "error";
      error: E;
    }
  | {
      tag: "success";
      value: A;
    }
> => {
  const layer = createLayer(botToken, chat);
  const provided = Effect.provide(effect, layer);
  const mapped = Effect.match(provided, {
    onFailure: (error) => ({ tag: "error" as const, error }),
    onSuccess: (value) => ({ tag: "success" as const, value }),
  });
  return Effect.runPromise(mapped);
};

const getErrorMessage = (error: unknown): string | undefined => {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  if (!("message" in error)) {
    return undefined;
  }
  const message = (error as { message?: unknown }).message;
  if (typeof message === "string") {
    return message;
  }
  return undefined;
};

describe("Telegram integration", () => {
  it("sends a live alert", async () => {
    if (!token || !chatId) {
      void Effect.runFork(
        Effect.logWarning("TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID missing, skipping"),
      );
      return;
    }

    const message = `Telegram integration test ${new Date().toISOString()}`;
    const effect = Effect.flatMap(TelegramService, (service) => service.sendAlert(message));
    const result = await runTestResult(effect, token, chatId);
    if (result.tag === "error") {
      const errorMessage = getErrorMessage(result.error);
      if (errorMessage === "fetch failed") {
        void Effect.runFork(Effect.logWarning("Telegram fetch failed, skipping integration test"));
        return;
      }
      throw result.error;
    }
    expect(result.value).toBeUndefined();
  });
});

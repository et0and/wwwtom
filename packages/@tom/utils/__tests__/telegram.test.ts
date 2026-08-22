import { afterEach, vi } from "vitest";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Redacted } from "effect";
import { TelegramService } from "../src/telegram";
import { AppConfig } from "../src/services/config";

type TestConfig = {
  telegramBotToken?: string;
  telegramChatId?: string;
};

const createConfigLayer = (config: TestConfig) =>
  Layer.succeed(AppConfig, {
    arenaToken: Redacted.make(""),
    arenaBaseUrl: undefined,
    payloadUrl: Redacted.make(""),
    databaseUrl: Redacted.make(""),
    telegramBotToken: config.telegramBotToken ? Redacted.make(config.telegramBotToken) : undefined,
    telegramChatId: config.telegramChatId,
    isDev: true,
  });

const withConfig = (config: TestConfig) =>
  Layer.provideMerge(TelegramService.Default, createConfigLayer(config));

const sendAlertEffect = (message: string) =>
  Effect.flatMap(TelegramService, (service) => service.sendAlert(message));

const sendErrorEffect = (message: string, cause?: unknown) =>
  Effect.flatMap(TelegramService, (service) => service.sendError(message, cause));

const toResult = <A, E>(effect: Effect.Effect<A, E, TelegramService>) =>
  Effect.match(effect, {
    onFailure: (error) => ({ tag: "error" as const, error }),
    onSuccess: (value) => ({ tag: "success" as const, value }),
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TelegramService", () => {
  it.effect("returns a no-op service when config missing", () =>
    Effect.gen(function* () {
      const response = { ok: true, status: 200, statusText: "OK" } as Response;
      const fetcher = vi.fn(async (_input: string, _init?: RequestInit) => response);
      vi.stubGlobal("fetch", fetcher);

      yield* sendAlertEffect("Hello").pipe(Effect.provide(withConfig({})));
      expect(fetcher).not.toHaveBeenCalled();
    }),
  );

  it.effect("returns a no-op when only token is present", () =>
    Effect.gen(function* () {
      const fetcher = vi.fn(async () => ({ ok: true, status: 200, statusText: "OK" }) as Response);
      vi.stubGlobal("fetch", fetcher);
      yield* sendAlertEffect("Hello").pipe(
        Effect.provide(withConfig({ telegramBotToken: "token" })),
      );
      expect(fetcher).not.toHaveBeenCalled();
    }),
  );

  it.effect("returns a no-op when only chatId is present", () =>
    Effect.gen(function* () {
      const fetcher = vi.fn(async () => ({ ok: true, status: 200, statusText: "OK" }) as Response);
      vi.stubGlobal("fetch", fetcher);
      yield* sendAlertEffect("Hello").pipe(Effect.provide(withConfig({ telegramChatId: "123" })));
      expect(fetcher).not.toHaveBeenCalled();
    }),
  );

  it.effect("sends alerts with expected payload", () =>
    Effect.gen(function* () {
      const response = { ok: true, status: 200, statusText: "OK" } as Response;
      const fetcher = vi.fn(async (_input: string, _init?: RequestInit) => response);
      vi.stubGlobal("fetch", fetcher);

      yield* sendAlertEffect("Hello").pipe(
        Effect.provide(withConfig({ telegramBotToken: "token", telegramChatId: "123" })),
      );

      expect(fetcher).toHaveBeenCalledTimes(1);
      const call = fetcher.mock.calls[0];
      if (!call) {
        throw new Error("Expected fetch to be called");
      }
      const url = call[0];
      const options = call[1];
      if (!options) {
        throw new Error("Expected fetch options");
      }

      expect(url).toBe("https://api.telegram.org/bottoken/sendMessage");
      expect(options.method).toBe("POST");
      expect(options.headers).toEqual({ "Content-Type": "application/json" });
      expect(options.body).toBeTypeOf("string");
      const body = JSON.parse(options.body as string);

      expect(body.chat_id).toBe("123");
      expect(body.text).toBe("Hello");
      expect(body.parse_mode).toBe("Markdown");
    }),
  );

  it.effect("formats errors in alert payloads", () =>
    Effect.gen(function* () {
      const response = { ok: true, status: 200, statusText: "OK" } as Response;
      const fetcher = vi.fn(async (_input: string, _init?: RequestInit) => response);
      vi.stubGlobal("fetch", fetcher);

      const error = new Error("Boom");
      error.stack = "Boom stack";

      yield* sendErrorEffect("Something broke", error).pipe(
        Effect.provide(withConfig({ telegramBotToken: "token", telegramChatId: "123" })),
      );

      const call = fetcher.mock.calls[0];
      if (!call) {
        throw new Error("Expected fetch to be called");
      }
      const options = call[1];
      if (!options) {
        throw new Error("Expected fetch options");
      }
      expect(options.body).toBeTypeOf("string");
      const body = JSON.parse(options.body as string);
      const text = body.text as string;

      expect(text).toContain("*ERROR*");
      expect(text).toContain("*Message:* Something broke");
      expect(text).toContain("*Error:* `Boom`");
      expect(text).toContain("*Time:*");
      expect(text).toContain("Boom stack");
    }),
  );

  it.effect("formats errors without cause", () =>
    Effect.gen(function* () {
      const fetcher = vi.fn(async () => ({ ok: true, status: 200, statusText: "OK" }) as Response);
      vi.stubGlobal("fetch", fetcher);

      yield* sendErrorEffect("Something broke").pipe(
        Effect.provide(withConfig({ telegramBotToken: "token", telegramChatId: "123" })),
      );

      const body = JSON.parse((fetcher.mock.calls[0]?.[1]?.body as string) ?? "{}");
      expect(body.text).toContain("*Message:* Something broke");
      expect(body.text).not.toContain("*Error:*");
      expect(body.text).toContain("*Time:*");
    }),
  );

  it.effect("formats string cause without stack", () =>
    Effect.gen(function* () {
      const fetcher = vi.fn(async () => ({ ok: true, status: 200, statusText: "OK" }) as Response);
      vi.stubGlobal("fetch", fetcher);

      yield* sendErrorEffect("Failed", "string cause").pipe(
        Effect.provide(withConfig({ telegramBotToken: "token", telegramChatId: "123" })),
      );

      const body = JSON.parse((fetcher.mock.calls[0]?.[1]?.body as string) ?? "{}");
      expect(body.text).toContain("*Error:* `string cause`");
      expect(body.text).not.toContain("*Stack:*");
    }),
  );

  it.effect("formats Error without stack property", () =>
    Effect.gen(function* () {
      const fetcher = vi.fn(async () => ({ ok: true, status: 200, statusText: "OK" }) as Response);
      vi.stubGlobal("fetch", fetcher);

      const error = new Error("Boom");
      error.stack = undefined;

      yield* sendErrorEffect("Failed", error).pipe(
        Effect.provide(withConfig({ telegramBotToken: "token", telegramChatId: "123" })),
      );

      const body = JSON.parse((fetcher.mock.calls[0]?.[1]?.body as string) ?? "{}");
      expect(body.text).toContain("*Error:* `Boom`");
      expect(body.text).not.toContain("*Stack:*");
    }),
  );

  it.effect("surfaces fetch errors as TelegramError", () =>
    Effect.gen(function* () {
      const fetcher = vi.fn(async (_input: string, _init?: RequestInit) => {
        throw new Error("Network down");
      });
      vi.stubGlobal("fetch", fetcher);

      const result = yield* sendAlertEffect("Hello").pipe(
        Effect.provide(withConfig({ telegramBotToken: "token", telegramChatId: "123" })),
        toResult,
      );

      expect(result.tag).toBe("error");
      if (result.tag !== "error") {
        throw new Error("Expected error result");
      }
      expect(result.error).toMatchObject({
        _tag: "TelegramError",
        message: "Network down",
      });
    }),
  );

  it.effect("surfaces non-ok responses as TelegramError", () =>
    Effect.gen(function* () {
      const response = {
        ok: false,
        status: 500,
        statusText: "Bad Gateway",
      } as Response;
      const fetcher = vi.fn(async (_input: string, _init?: RequestInit) => response);
      vi.stubGlobal("fetch", fetcher);

      const result = yield* sendAlertEffect("Hello").pipe(
        Effect.provide(withConfig({ telegramBotToken: "token", telegramChatId: "123" })),
        toResult,
      );

      expect(result.tag).toBe("error");
      if (result.tag !== "error") {
        throw new Error("Expected error result");
      }
      expect(result.error).toMatchObject({
        _tag: "TelegramError",
        message: "Telegram API error: 500 Bad Gateway",
        status: 500,
      });
    }),
  );
});

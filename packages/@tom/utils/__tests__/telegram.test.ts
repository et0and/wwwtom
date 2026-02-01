import { afterEach, describe, expect, it, vi } from "vitest";
import { Effect, Layer, Redacted } from "effect";
import { TelegramService, TelegramServiceLive } from "../src/telegram";
import { AppConfig } from "../src/services/config";

type TestConfig = {
  telegramBotToken?: string;
  telegramChatId?: string;
};

const createConfigLayer = (config: TestConfig) => {
  const token = config.telegramBotToken;
  const chatId = config.telegramChatId;
  return Layer.succeed(AppConfig, {
    arenaToken: Redacted.make(""),
    payloadUrl: Redacted.make(""),
    databaseUrl: Redacted.make(""),
    telegramBotToken: token ? Redacted.make(token) : undefined,
    telegramChatId: chatId,
    isDev: true,
  });
};

const createLayer = (config: TestConfig) =>
  Layer.provideMerge(TelegramServiceLive, createConfigLayer(config));

const runTestEffect = <A, E>(
  effect: Effect.Effect<A, E, TelegramService>,
  config: TestConfig,
): Promise<A> => {
  const layer = createLayer(config);
  const provided = Effect.provide(effect, layer);
  return Effect.runPromise(provided);
};

const runTestResult = <A, E>(
  effect: Effect.Effect<A, E, TelegramService>,
  config: TestConfig,
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
  const layer = createLayer(config);
  const provided = Effect.provide(effect, layer);
  const mapped = Effect.match(provided, {
    onFailure: (error) => ({ tag: "error" as const, error }),
    onSuccess: (value) => ({ tag: "success" as const, value }),
  });
  return Effect.runPromise(mapped);
};

const sendAlertEffect = (message: string) =>
  Effect.flatMap(TelegramService, (service) => service.sendAlert(message));

const sendErrorEffect = (message: string, error?: unknown) =>
  Effect.flatMap(TelegramService, (service) => service.sendError(message, error));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TelegramService", () => {
  it("returns a no-op service when config missing", async () => {
    const response = { ok: true, status: 200, statusText: "OK" } as Response;
    const fetcher = vi.fn(async (input: string, init?: RequestInit) => response);
    vi.stubGlobal("fetch", fetcher);

    await runTestEffect(sendAlertEffect("Hello"), {});
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends alerts with expected payload", async () => {
    const response = { ok: true, status: 200, statusText: "OK" } as Response;
    const fetcher = vi.fn(async (input: string, init?: RequestInit) => response);
    vi.stubGlobal("fetch", fetcher);

    await runTestEffect(sendAlertEffect("Hello"), {
      telegramBotToken: "token",
      telegramChatId: "123",
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const call = fetcher.mock.calls[0];
    if (!call) {
      throw new Error("Expected fetch to be called");
    }
    const url = call[0];
    if (typeof url !== "string") {
      throw new Error("Expected fetch url");
    }
    const options = call[1];
    if (!options) {
      throw new Error("Expected fetch options");
    }

    expect(url).toBe("https://api.telegram.org/bottoken/sendMessage");
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({ "Content-Type": "application/json" });
    if (typeof options.body !== "string") {
      throw new Error("Expected fetch body");
    }
    const body = JSON.parse(options.body);

    expect(body.chat_id).toBe("123");
    expect(body.text).toBe("Hello");
    expect(body.parse_mode).toBe("Markdown");
  });

  it("formats errors in alert payloads", async () => {
    const response = { ok: true, status: 200, statusText: "OK" } as Response;
    const fetcher = vi.fn(async (input: string, init?: RequestInit) => response);
    vi.stubGlobal("fetch", fetcher);

    const error = new Error("Boom");
    error.stack = "Boom stack";

    await runTestEffect(sendErrorEffect("Something broke", error), {
      telegramBotToken: "token",
      telegramChatId: "123",
    });

    const call = fetcher.mock.calls[0];
    if (!call) {
      throw new Error("Expected fetch to be called");
    }
    const options = call[1];
    if (!options) {
      throw new Error("Expected fetch options");
    }
    if (typeof options.body !== "string") {
      throw new Error("Expected fetch body");
    }
    const body = JSON.parse(options.body);
    const text = body.text as string;

    expect(text).toContain("*ERROR*");
    expect(text).toContain("*Message:* Something broke");
    expect(text).toContain("*Error:* `Boom`");
    expect(text).toContain("*Time:*");
    expect(text).toContain("Boom stack");
  });

  it("surfaces fetch errors as TelegramError", async () => {
    const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
      throw new Error("Network down");
    });
    vi.stubGlobal("fetch", fetcher);

    const effect = sendAlertEffect("Hello");
    const result = await runTestResult(effect, {
      telegramBotToken: "token",
      telegramChatId: "123",
    });

    expect(result.tag).toBe("error");
    if (result.tag !== "error") {
      throw new Error("Expected error result");
    }
    expect(result.error).toMatchObject({
      _tag: "TelegramError",
      message: "Network down",
    });
  });

  it("surfaces non-ok responses as TelegramError", async () => {
    const response = {
      ok: false,
      status: 500,
      statusText: "Bad Gateway",
    } as Response;
    const fetcher = vi.fn(async (input: string, init?: RequestInit) => response);
    vi.stubGlobal("fetch", fetcher);

    const result = await runTestResult(sendAlertEffect("Hello"), {
      telegramBotToken: "token",
      telegramChatId: "123",
    });

    expect(result.tag).toBe("error");
    if (result.tag !== "error") {
      throw new Error("Expected error result");
    }
    expect(result.error).toMatchObject({
      _tag: "TelegramError",
      message: "Telegram API error: 500 Bad Gateway",
      status: 500,
    });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { Effect, Layer } from "effect";
import type { ErrorAlertDetails } from "@tom/schemas/telegram";
import { TelegramService } from "../src/telegram";
import { makeAppConfigLayer } from "../src/services/config";

type TestConfig = {
  telegramBotToken?: string;
  telegramChatId?: string;
};

type AlertBody = {
  chat_id?: unknown;
  text?: unknown;
  parse_mode?: unknown;
  reply_markup?: unknown;
};

const createLayer = (config: TestConfig) =>
  Layer.provideMerge(
    TelegramService.Default,
    makeAppConfigLayer({
      TELEGRAM_BOT_TOKEN: config.telegramBotToken,
      TELEGRAM_CHAT_ID: config.telegramChatId,
    }),
  );

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

const sendErrorEffect = (message: string, cause?: unknown, details?: ErrorAlertDetails) =>
  Effect.flatMap(TelegramService, (service) => service.sendError(message, cause, details));

const stubAlertFetch = () => {
  const response = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  const fetcher = vi.fn(async (_input: string, _init?: RequestInit) => response);
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
};

const captureAlert = async <A, E>(
  effect: Effect.Effect<A, E, TelegramService>,
  config: TestConfig,
): Promise<{
  fetcher: ReturnType<typeof stubAlertFetch>;
  url: string;
  options: RequestInit;
  body: AlertBody;
}> => {
  const fetcher = stubAlertFetch();
  await runTestEffect(effect, config);

  const call = fetcher.mock.calls[0];
  if (!call) {
    throw new Error("Expected fetch to be called");
  }
  const [url, options] = call;
  if (!options) {
    throw new Error("Expected fetch options");
  }
  expect(options.body).toBeInstanceOf(Uint8Array);
  const body = JSON.parse(new TextDecoder().decode(options.body as Uint8Array)) as AlertBody;
  return { fetcher, url: String(url), options, body };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TelegramService", () => {
  it("returns a no-op service when config missing", async () => {
    const fetcher = stubAlertFetch();

    await runTestEffect(sendAlertEffect("Hello"), {});
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("sends alerts with expected payload", async () => {
    const { fetcher, url, options, body } = await captureAlert(sendAlertEffect("Hello"), {
      telegramBotToken: "token",
      telegramChatId: "123",
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(url).toBe("https://api.telegram.org/bottoken/sendMessage");
    expect(options.method).toBe("POST");
    expect(new Headers(options.headers).get("content-type")).toBe("application/json");

    expect(body.chat_id).toBe("123");
    expect(body.text).toBe("Hello");
    expect(body.parse_mode).toBe("Markdown");
  });

  it("formats errors in alert payloads", async () => {
    const error = new Error("Boom");
    error.stack = "Boom stack";

    const { body } = await captureAlert(sendErrorEffect("Something broke", error), {
      telegramBotToken: "token",
      telegramChatId: "123",
    });
    const text = body.text as string;

    expect(text).toContain("*ERROR*");
    expect(text).toContain("*Message:* Something broke");
    expect(text).toContain("*Error:* `Boom`");
    expect(text).toContain("*Time:*");
    expect(text).toContain("Boom stack");
  });

  it("includes request details and log lookup in alert payloads", async () => {
    const { body } = await captureAlert(
      sendErrorEffect("Adapter 500 error", new Error("Boom"), {
        service: "tom-adapter",
        stage: "staging",
        status: 500,
        method: "GET",
        path: "/guestbook/entries",
        requestId: "req-123",
        userId: "tom@example",
      }),
      { telegramBotToken: "token", telegramChatId: "123" },
    );
    const text = body.text as string;

    expect(text).toContain("*ERROR · tom-adapter · staging · 500*");
    expect(text).toContain("*Route:* GET /guestbook/entries");
    expect(text).toContain("*Request:* `req-123`");
    expect(text).toContain("*User:* `tom@example`");
    expect(text).toContain("['tom-logs'] | where requestId == 'req-123'");
  });

  it("attaches link buttons when details include links", async () => {
    const { body } = await captureAlert(
      sendErrorEffect("Something broke", new Error("Boom"), {
        service: "tom-api",
        links: [{ text: "Cloudflare Workers", url: "https://dash.cloudflare.com/?to=/:account/x" }],
      }),
      { telegramBotToken: "token", telegramChatId: "123" },
    );

    expect(body.reply_markup).toEqual({
      inline_keyboard: [
        [{ text: "Cloudflare Workers", url: "https://dash.cloudflare.com/?to=/:account/x" }],
      ],
    });
  });

  it("omits reply markup when details have no links", async () => {
    const { body } = await captureAlert(sendErrorEffect("Something broke", new Error("Boom")), {
      telegramBotToken: "token",
      telegramChatId: "123",
    });

    expect(body.reply_markup).toBeUndefined();
  });

  it("truncates long stacks and caps alert length", async () => {
    const error = new Error("Boom");
    error.stack = "x".repeat(5000);

    const { body } = await captureAlert(sendErrorEffect("Something broke", error), {
      telegramBotToken: "token",
      telegramChatId: "123",
    });
    const text = body.text as string;

    expect(text).toContain("(truncated)");
    expect(text.length).toBeLessThanOrEqual(3900);
  });

  it("surfaces fetch errors as TelegramError", async () => {
    const fetcher = vi.fn(async (_input: string, _init?: RequestInit) => {
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
    const fetcher = vi.fn(async (_input: string, _init?: RequestInit) => response);
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
      message: "Telegram API error: 500",
      status: 500,
    });
  });
});

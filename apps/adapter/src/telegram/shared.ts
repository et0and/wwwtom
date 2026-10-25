import { Effect, Layer, Option } from "effect";
import { Headers, HttpBody, HttpClient, HttpClientResponse } from "effect/unstable/http";
import type { TelegramUpdate } from "@tom/schemas/telegram";
import { AgentMessageResponseSchema } from "@tom/schemas/agent";
import type { AgentMessageResponse } from "@tom/schemas/agent";
import { HttpStatus } from "@tom/constants/http";
import { INTERNAL_TOKEN_HEADER, TELEGRAM_WEBHOOK_TOKEN_HEADER } from "@tom/constants/headers";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import { HttpError } from "@tom/types/errors";
import { liveHttpClient } from "@tom/utils/http";
import { timingSafeEqual } from "@tom/utils/crypto";
import {
  makeAppConfigLayer,
  readCloudflareEnv,
  tenantFromValue,
  type CloudflareEnv,
} from "@tom/utils/config";
import { TelegramService } from "@tom/utils/telegram";
import type { LogContext } from "@tom/utils/logging";
import { getRequestEnv } from "@tom/utils/worker";
import { AdapterError, runAdapter } from "../runtime";

/** Upper bound for one agent turn; Telegram allows ~200s before retrying. */
const AGENT_TURN_TIMEOUT_MS = 100_000;

interface TelegramAgentConfig {
  readonly webhookSecret: string;
  readonly botToken: string;
  readonly ownerChatId: string;
  readonly apiUrl: string;
  readonly internalToken: string;
}

const unconfigured = (variable: string): HttpError =>
  new HttpError({
    message: `Telegram agent is not configured (${variable} missing)`,
    status: HttpStatus.ServiceUnavailable,
  });

/**
 * Required config, resolved from the TOM_SECRETS bundle once per request.
 * Fail closed: a missing webhook secret or bot token must never fall back to
 * a no-op reply loop.
 */
const resolveTelegramConfig = (env: CloudflareEnv): Effect.Effect<TelegramAgentConfig, HttpError> =>
  Effect.gen(function* () {
    const resolved = yield* Effect.tryPromise({
      try: () => readCloudflareEnv(env),
      catch: (cause) =>
        new HttpError({
          message: "Telegram configuration unavailable",
          status: HttpStatus.InternalServerError,
          cause,
        }),
    });
    const required = (variable: string, value: string | undefined) =>
      Effect.fromOption(Option.fromNullishOr(value), () => unconfigured(variable));
    const webhookSecret = yield* required(
      "TELEGRAM_WEBHOOK_SECRET",
      resolved.TELEGRAM_WEBHOOK_SECRET,
    );
    const botToken = yield* required("TELEGRAM_BOT_TOKEN", resolved.TELEGRAM_BOT_TOKEN);
    const ownerChatId = yield* required("TELEGRAM_CHAT_ID", resolved.TELEGRAM_CHAT_ID);
    const internalToken = yield* required("INTERNAL_API_TOKEN", resolved.INTERNAL_API_TOKEN);
    return {
      webhookSecret,
      botToken,
      ownerChatId,
      internalToken,
      apiUrl: resolved.API_URL ?? LOCAL_SERVICE_URLS.api,
    };
  });

/** The agent is Tom-only; Sophie's adapter answers every path it can't serve. */
export const requireTelegramTenant = (request: Request): void => {
  if (tenantFromValue(getRequestEnv(request).TENANT) === "sophie") {
    throw new AdapterError({ status: HttpStatus.NotFound, message: "Not found" });
  }
};

/** Verify the setWebhook secret_token header; fail-closed when absent. */
const authenticateUpdate = Effect.fn("Telegram.authenticateUpdate")(function* (
  request: Request,
  expectedSecret: string,
) {
  const provided = request.headers.get(TELEGRAM_WEBHOOK_TOKEN_HEADER);
  if (!provided || !timingSafeEqual(provided, expectedSecret)) {
    yield* Effect.logWarning("Telegram webhook auth failed");
    return yield* new HttpError({
      message: "Unauthorized",
      status: HttpStatus.Unauthorized,
    });
  }
});

const forwardToAgent = (options: {
  readonly apiUrl: string;
  readonly internalToken: string;
  readonly chatId: string;
  readonly message: string;
}): Effect.Effect<AgentMessageResponse, HttpError> =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client
      .post(`${options.apiUrl}/agent/message`, {
        headers: Headers.fromInput({
          "Content-Type": "application/json",
          [INTERNAL_TOKEN_HEADER]: options.internalToken,
        }),
        body: yield* HttpBody.json({
          chatId: options.chatId,
          message: options.message,
        }).pipe(
          Effect.mapError(
            (cause) =>
              new HttpError({
                message: "Failed to encode agent request",
                status: HttpStatus.InternalServerError,
                cause,
              }),
          ),
        ),
      })
      .pipe(
        Effect.mapError(
          (cause) =>
            new HttpError({
              message: "Agent unavailable",
              status: HttpStatus.BadGateway,
              cause,
            }),
        ),
      );
    const okResponse = yield* HttpClientResponse.filterStatusOk(response).pipe(
      Effect.mapError((error) => {
        const status = error.response?.status;
        return new HttpError({
          message: `Agent error${status === undefined ? "" : `: ${status}`}`,
          status: status ?? HttpStatus.BadGateway,
        });
      }),
    );
    return yield* HttpClientResponse.schemaBodyJson(AgentMessageResponseSchema)(okResponse).pipe(
      Effect.mapError(
        (cause) =>
          new HttpError({
            message: "Agent returned an invalid response",
            status: HttpStatus.BadGateway,
            cause,
          }),
      ),
    );
  }).pipe(Effect.provide(liveHttpClient()));

/** Reply leg: thread onto the inbound message; a failed reply never 500s the webhook. */
const sendReply = Effect.fn("Telegram.sendReply")(function* (
  reply: string,
  chatId: number,
  replyToMessageId: number,
) {
  const telegram = yield* TelegramService;
  yield* telegram
    .sendMessage({
      chatId: String(chatId),
      text: reply,
      replyToMessageId,
    })
    .pipe(
      Effect.catchTag("TelegramError", (error) =>
        Effect.logWarning("Telegram reply failed", { error: error.message }),
      ),
    );
});

/**
 * Handle one update against resolved config. Updates this app ignores (edits,
 * callback queries, media) and stranger chats succeed silently, so Telegram
 * never retries against a quiet bot.
 */
export const handleTelegramUpdate = (
  request: Request,
  update: TelegramUpdate,
  config: TelegramAgentConfig,
): Effect.Effect<{ readonly ok: boolean }, HttpError, TelegramService> =>
  Effect.gen(function* () {
    yield* authenticateUpdate(request, config.webhookSecret);
    const message = Option.fromNullishOr(update.message);
    const text = Option.flatMap(message, (value) => Option.fromNullishOr(value.text));
    if (Option.isNone(message) || Option.isNone(text)) {
      yield* Effect.logInfo("Telegram update ignored", { updateId: update.update_id });
      return { ok: true };
    }
    const chatId = message.value.chat.id;
    if (String(chatId) !== config.ownerChatId) {
      yield* Effect.logWarning("Telegram update from stranger chat ignored");
      return { ok: true };
    }
    const reply = yield* forwardToAgent({
      apiUrl: config.apiUrl,
      internalToken: config.internalToken,
      chatId: String(chatId),
      message: text.value,
    }).pipe(
      Effect.timeoutOrElse({
        duration: AGENT_TURN_TIMEOUT_MS,
        orElse: () =>
          Effect.fail(
            new HttpError({
              message: "Agent turn timed out",
              status: HttpStatus.GatewayTimeout,
            }),
          ),
      }),
    );
    yield* sendReply(reply.reply, chatId, message.value.message_id);
    return { ok: true };
  });

/**
 * Run the handler with config resolved from this request and a Telegram
 * service built from that same resolved env — the raw worker env only carries
 * the TOM_SECRETS binding in production, so building the service from it
 * would silently turn every reply into a no-op.
 */
export const runTelegram = (
  env: CloudflareEnv,
  handling: (
    config: TelegramAgentConfig,
  ) => Effect.Effect<{ ok: boolean }, HttpError, TelegramService>,
  context: LogContext,
): Promise<{ ok: boolean }> =>
  runAdapter(
    Effect.gen(function* () {
      const config = yield* resolveTelegramConfig(env);
      return yield* handling(config).pipe(
        Effect.provide(
          Layer.provide(
            TelegramService.Default,
            makeAppConfigLayer({
              TELEGRAM_BOT_TOKEN: config.botToken,
              TELEGRAM_CHAT_ID: config.ownerChatId,
            }),
          ),
        ),
      );
    }),
    (error) => new AdapterError({ status: error.status, message: error.message }),
    context,
  );

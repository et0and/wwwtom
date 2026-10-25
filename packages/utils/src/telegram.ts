import { Context, Effect, Layer, Redacted } from "effect";
import { Headers, HttpBody, HttpClient, HttpClientResponse } from "effect/unstable/http";
import { TelegramError } from "@tom/types/errors";
import type { AlertLink, ErrorAlertDetails } from "@tom/schemas/telegram";
import {
  MAX_ALERT_LENGTH,
  MAX_STACK_LENGTH,
  telegramSendResponseSchema,
} from "@tom/schemas/telegram";
import { AppConfig } from "./config";
import { liveHttpClient } from "./http";
import { toErrorMessage } from "./worker";

export interface TelegramServiceContract {
  readonly sendAlert: (message: string) => Effect.Effect<void, TelegramError>;
  readonly sendError: (
    message: string,
    cause?: unknown,
    details?: ErrorAlertDetails,
  ) => Effect.Effect<void, TelegramError>;
  /**
   * Send a plain-text reply to one chat (no Markdown parsing, so agent
   * output never trips Telegram's parser). Replies thread onto the inbound
   * message when `replyToMessageId` is set.
   */
  readonly sendMessage: (options: {
    readonly chatId: string;
    readonly text: string;
    readonly replyToMessageId?: number;
  }) => Effect.Effect<void, TelegramError>;
}

interface TelegramSendOptions {
  readonly chatId: string;
  readonly text: string;
  readonly parseMode?: "Markdown";
  readonly replyToMessageId?: number;
  readonly links?: readonly AlertLink[];
}

const truncate = (value: string, max: number): string =>
  value.length > max ? `${value.slice(0, max)}\n… (truncated)` : value;

const formatIdentitySection = (details?: ErrorAlertDetails): string => {
  if (!details) return "";
  const lines = [
    details.requestId && `*Request:* \`${details.requestId}\``,
    details.sessionId && `*Session:* \`${details.sessionId}\``,
    details.userId && `*User:* \`${details.userId}\``,
  ].filter(Boolean);
  return lines.length > 0 ? `\n${lines.join("\n")}` : "";
};

const formatCauseSection = (cause?: unknown): string => {
  if (!cause) return "";
  const errorStr = toErrorMessage(cause);
  const stack = cause instanceof Error ? cause.stack : undefined;
  const stackSection = stack
    ? `\n\n*Stack:*\n\`\`\`\n${truncate(stack, MAX_STACK_LENGTH)}\n\`\`\``
    : "";
  return `\n\n*Error:* \`${errorStr}\`${stackSection}`;
};

const formatLogSection = (requestId?: string): string =>
  requestId
    ? `\n\n*Find logs (Axiom \`tom-logs\`):*\n\`\`\`\n['tom-logs'] | where requestId == '${requestId}'\n\`\`\``
    : "";

const formatErrorMessage = (
  message: string,
  cause?: unknown,
  details?: ErrorAlertDetails,
): string => {
  const timestamp = new Date().toISOString();
  const title = [details?.service, details?.stage, details?.status]
    .filter((part) => part !== undefined)
    .join(" · ");
  const route = [details?.method, details?.path].filter(Boolean).join(" ");
  const text =
    `${title ? `*ERROR · ${title}*` : "*ERROR*"}\n\n` +
    `*Time:* ${timestamp}\n` +
    `*Message:* ${message}` +
    (route ? `\n*Route:* ${route}` : "") +
    formatIdentitySection(details) +
    formatCauseSection(cause) +
    formatLogSection(details?.requestId);
  return truncate(text, MAX_ALERT_LENGTH);
};

export class TelegramService extends Context.Service<TelegramService, TelegramServiceContract>()(
  "TelegramService",
) {
  static readonly Default = Layer.effect(
    TelegramService,
    Effect.gen(function* () {
      const config = yield* AppConfig;

      if (!config.telegramBotToken || !config.telegramChatId) {
        const service: TelegramServiceContract = {
          sendAlert: Effect.fn("TelegramService.sendAlert")(
            (): Effect.Effect<void, TelegramError> => Effect.void,
          ),
          sendError: Effect.fn("TelegramService.sendError")(
            (): Effect.Effect<void, TelegramError> => Effect.void,
          ),
          sendMessage: Effect.fn("TelegramService.sendMessage")(
            (): Effect.Effect<void, TelegramError> => Effect.void,
          ),
        };
        return service;
      }

      const token = Redacted.value(config.telegramBotToken);
      const chatId = config.telegramChatId;

      const doSendTelegram = Effect.fn("doSendTelegram")(function* (options: TelegramSendOptions) {
        const client = yield* HttpClient.HttpClient;
        const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;

        const requestBody = yield* HttpBody.json({
          chat_id: options.chatId,
          text: options.text,
          ...(options.parseMode && { parse_mode: options.parseMode }),
          ...(options.replyToMessageId && {
            reply_to_message_id: options.replyToMessageId,
          }),
          ...(options.links &&
            options.links.length > 0 && {
              reply_markup: {
                inline_keyboard: [
                  options.links.map((link) => ({ text: link.text, url: link.url })),
                ],
              },
            }),
        }).pipe(
          Effect.mapError(
            () => new TelegramError({ message: "Failed to encode Telegram request" }),
          ),
        );

        const response = yield* client
          .post(telegramUrl, {
            headers: Headers.fromInput({ "Content-Type": "application/json" }),
            body: requestBody,
          })
          .pipe(
            Effect.mapError((error) => {
              const cause = "cause" in error.reason ? error.reason.cause : undefined;
              return new TelegramError({
                message: toErrorMessage(cause ?? error),
              });
            }),
          );

        const okResponse = yield* HttpClientResponse.filterStatusOk(response).pipe(
          Effect.mapError((error) => {
            const status = error.response?.status;
            return new TelegramError({
              message: `Telegram API error: ${status ?? "unknown status"}`,
              ...(status !== undefined && { status }),
            });
          }),
        );

        yield* HttpClientResponse.schemaBodyJson(telegramSendResponseSchema)(okResponse).pipe(
          Effect.mapError(
            () => new TelegramError({ message: "Telegram API error: unexpected response" }),
          ),
        );
      });

      const service: TelegramServiceContract = {
        // Resolve fetch per call: the Fetch reference default pins the
        // first-seen implementation process-wide, which breaks stubbed fetch
        // in tests (and hides the seam in production).
        sendAlert: Effect.fn("TelegramService.sendAlert")((message: string) =>
          Effect.provide(
            doSendTelegram({ chatId, text: message, parseMode: "Markdown" }),
            liveHttpClient(),
          ),
        ),
        sendError: Effect.fn("TelegramService.sendError")(
          (message: string, cause?: unknown, details?: ErrorAlertDetails) =>
            Effect.provide(
              doSendTelegram({
                chatId,
                text: formatErrorMessage(message, cause, details),
                parseMode: "Markdown",
                ...(details?.links && { links: details.links }),
              }),
              liveHttpClient(),
            ),
        ),
        sendMessage: Effect.fn("TelegramService.sendMessage")((options) =>
          Effect.provide(
            doSendTelegram({
              chatId: options.chatId,
              text: truncate(options.text, MAX_ALERT_LENGTH),
              ...(options.replyToMessageId && { replyToMessageId: options.replyToMessageId }),
            }),
            liveHttpClient(),
          ),
        ),
      };
      return service;
    }),
  );
}

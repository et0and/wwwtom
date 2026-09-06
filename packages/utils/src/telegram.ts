import { Context, Effect, Layer, Redacted } from "effect";
import {
  FetchHttpClient,
  Headers,
  HttpBody,
  HttpClient,
  HttpClientResponse,
} from "effect/unstable/http";
import { TelegramError } from "@tom/types/errors";
import type { AlertLink, ErrorAlertDetails } from "@tom/schemas/telegram";
import {
  MAX_ALERT_LENGTH,
  MAX_STACK_LENGTH,
  telegramSendResponseSchema,
} from "@tom/schemas/telegram";
import { AppConfig } from "./services/config";

export interface TelegramServiceContract {
  readonly sendAlert: (message: string) => Effect.Effect<void, TelegramError>;
  readonly sendError: (
    message: string,
    cause?: unknown,
    details?: ErrorAlertDetails,
  ) => Effect.Effect<void, TelegramError>;
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
  const errorStr = cause instanceof Error ? cause.message : String(cause);
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
        };
        return service;
      }

      const token = Redacted.value(config.telegramBotToken);
      const chatId = config.telegramChatId;

      const doSendTelegramAlert = Effect.fn("doSendTelegramAlert")(function* (
        text: string,
        links?: readonly AlertLink[],
      ) {
        const client = yield* HttpClient.HttpClient;
        const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;

        const requestBody = yield* HttpBody.json({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
          ...(links &&
            links.length > 0 && {
              reply_markup: {
                inline_keyboard: [links.map((link) => ({ text: link.text, url: link.url }))],
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
                message: cause instanceof Error ? cause.message : error.message,
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

      const liveHttpClient = (): Layer.Layer<HttpClient.HttpClient> =>
        Layer.provideMerge(
          FetchHttpClient.layer,
          Layer.succeed(FetchHttpClient.Fetch, globalThis.fetch),
        );

      const service: TelegramServiceContract = {
        // Resolve fetch per call: the Fetch reference default pins the
        // first-seen implementation process-wide, which breaks stubbed fetch
        // in tests (and hides the seam in production).
        sendAlert: Effect.fn("TelegramService.sendAlert")((message: string) =>
          Effect.provide(doSendTelegramAlert(message), liveHttpClient()),
        ),
        sendError: Effect.fn("TelegramService.sendError")(
          (message: string, cause?: unknown, details?: ErrorAlertDetails) =>
            Effect.provide(
              doSendTelegramAlert(formatErrorMessage(message, cause, details), details?.links),
              liveHttpClient(),
            ),
        ),
      };
      return service;
    }),
  );
}

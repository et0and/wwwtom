import { Context, Effect, Layer, Redacted } from "effect";
import { TelegramError } from "@tom/types/errors";
import { AppConfig } from "./services/config";

export interface AlertLink {
  readonly text: string;
  readonly url: string;
}

export interface ErrorAlertDetails {
  readonly service?: string;
  readonly stage?: string;
  readonly status?: number;
  readonly method?: string;
  readonly path?: string;
  readonly requestId?: string;
  readonly sessionId?: string;
  readonly userId?: string;
  readonly links?: readonly AlertLink[];
}

export interface TelegramServiceContract {
  readonly sendAlert: (message: string) => Effect.Effect<void, TelegramError>;
  readonly sendError: (
    message: string,
    cause?: unknown,
    details?: ErrorAlertDetails,
  ) => Effect.Effect<void, TelegramError>;
}

const MAX_ALERT_LENGTH = 3900;
const MAX_STACK_LENGTH = 1200;

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
                ...(links &&
                  links.length > 0 && {
                    reply_markup: {
                      inline_keyboard: [links.map((link) => ({ text: link.text, url: link.url }))],
                    },
                  }),
              }),
            }),
          catch: (error) =>
            new TelegramError({
              message: error instanceof Error ? error.message : "Unknown error",
            }),
        });

        if (!response.ok) {
          return yield* new TelegramError({
            message: `Telegram API error: ${response.status} ${response.statusText}`,
            status: response.status,
          });
        }
      });

      const service: TelegramServiceContract = {
        sendAlert: Effect.fn("TelegramService.sendAlert")((message: string) =>
          doSendTelegramAlert(message),
        ),
        sendError: Effect.fn("TelegramService.sendError")(
          (message: string, cause?: unknown, details?: ErrorAlertDetails) =>
            doSendTelegramAlert(formatErrorMessage(message, cause, details), details?.links),
        ),
      };
      return service;
    }),
  );
}

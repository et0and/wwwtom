import { Schema } from "effect";

const AlertLinkSchema = Schema.Struct({
  text: Schema.String,
  url: Schema.String,
});

export type AlertLink = Schema.Schema.Type<typeof AlertLinkSchema>;

/**
 * Correlation details attached to Telegram error alerts: the originating
 * service and stage, the failing route and status, the requestId that ties
 * Axiom logs/traces and Workers Logs together, and dashboard link buttons.
 */
const ErrorAlertDetailsSchema = Schema.Struct({
  service: Schema.optional(Schema.String),
  stage: Schema.optional(Schema.String),
  status: Schema.optional(Schema.Finite),
  method: Schema.optional(Schema.String),
  path: Schema.optional(Schema.String),
  requestId: Schema.optional(Schema.String),
  sessionId: Schema.optional(Schema.String),
  userId: Schema.optional(Schema.String),
  links: Schema.optional(Schema.Array(AlertLinkSchema)),
});

export type ErrorAlertDetails = Schema.Schema.Type<typeof ErrorAlertDetailsSchema>;

/** Telegram Bot API caps message text at 4096 characters; stay under it. */
export const MAX_ALERT_LENGTH = 3900;

/** Stack traces truncate past this so one alert never crowds out context. */
export const MAX_STACK_LENGTH = 1200;

/**
 * POST /bot<token>/sendMessage → 200. This app only needs delivery
 * confirmation; decoding `ok: true` fails the Effect when Telegram
 * rejects the message instead of silently succeeding.
 *
 * @see https://core.telegram.org/bots/api#sendmessage
 */
const TelegramSendResponseSchema = Schema.Struct({
  ok: Schema.Literal(true),
});

export const telegramSendResponseSchema = TelegramSendResponseSchema;

/**
 * Minimal inbound Telegram update. Only text messages inside a chat matter;
 * every other update type (callback queries, edits, media) succeeds silently
 * so the webhook never 500s on an update shape this app ignores.
 *
 * @see https://core.telegram.org/bots/api#update
 */
export const TelegramUpdateSchema = Schema.Struct({
  update_id: Schema.Finite,
  message: Schema.optional(
    Schema.Struct({
      message_id: Schema.Finite,
      chat: Schema.Struct({ id: Schema.Finite }),
      text: Schema.optional(Schema.String),
    }),
  ),
});

export type TelegramUpdate = Schema.Schema.Type<typeof TelegramUpdateSchema>;

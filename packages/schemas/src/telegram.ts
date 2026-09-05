import { Schema } from "effect";

const AlertLinkSchema = Schema.Struct({
  text: Schema.String,
  url: Schema.String,
});

export const alertLinkSchema = AlertLinkSchema;

export type AlertLink = Schema.Schema.Type<typeof AlertLinkSchema>;

/**
 * Correlation details attached to Telegram error alerts: the originating
 * service and stage, the failing route and status, the requestId that ties
 * Axiom logs/traces and Workers Logs together, and dashboard link buttons.
 */
const ErrorAlertDetailsSchema = Schema.Struct({
  service: Schema.optional(Schema.String),
  stage: Schema.optional(Schema.String),
  status: Schema.optional(Schema.Number),
  method: Schema.optional(Schema.String),
  path: Schema.optional(Schema.String),
  requestId: Schema.optional(Schema.String),
  sessionId: Schema.optional(Schema.String),
  userId: Schema.optional(Schema.String),
  links: Schema.optional(Schema.Array(AlertLinkSchema)),
});

export const errorAlertDetailsSchema = ErrorAlertDetailsSchema;

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

export type TelegramSendResponse = Schema.Schema.Type<typeof TelegramSendResponseSchema>;

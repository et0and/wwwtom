/**
 * Header the adapter sends when calling the Tom API's internal routes.
 * The value must match `INTERNAL_API_TOKEN` from TOM_SECRETS; the API
 * verifies it before serving `/og`, `/auth/*`, and `/cms/*`.
 */
export const INTERNAL_TOKEN_HEADER = "x-internal-token";

/**
 * Header Telegram sends with every webhook update when `secret_token` is set
 * via setWebhook. The adapter compares it against `TELEGRAM_WEBHOOK_SECRET`
 * from TOM_SECRETS; fail-closed when the secret isn't configured.
 */
export const TELEGRAM_WEBHOOK_TOKEN_HEADER = "x-telegram-bot-api-secret-token";

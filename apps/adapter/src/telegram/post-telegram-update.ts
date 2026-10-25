import { Elysia } from "elysia";
import { Schema } from "effect";
import { TelegramUpdateSchema } from "@tom/schemas/telegram";
import { handleTelegramUpdate, requireTelegramTenant, runTelegram } from "./shared";
import { logContextFromRequest, getRequestEnv } from "@tom/utils/worker";

/**
 * Telegram webhook: inbound updates for the agent. Telegram authenticates
 * the route itself (setWebhook secret_token), so this sits outside the
 * web-origin/CORS plumbing every browser integration uses.
 */
export const postTelegramUpdateRoute = new Elysia().post(
  "/telegram/update",
  ({ body, request }) => {
    requireTelegramTenant(request);
    const env = getRequestEnv(request);
    return runTelegram(
      env,
      (config) => handleTelegramUpdate(request, body, config),
      logContextFromRequest(request, "tom-adapter"),
    );
  },
  {
    body: Schema.toStandardSchemaV1(TelegramUpdateSchema),
    detail: { description: "Telegram webhook updates for the agent", tags: ["telegram"] },
  },
);

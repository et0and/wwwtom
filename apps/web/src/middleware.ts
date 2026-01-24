"use server";

import { createMiddleware } from "@solidjs/start/middleware";
import type { CloudflareEnv } from "@tom/utils/services";
import { createServicesLayer } from "~/libs/runtime";

export default createMiddleware({
  onRequest: (event) => {
    const cf = event.nativeEvent.context.cloudflare;
    const cfEnv = cf?.env as CloudflareEnv | undefined;
    const env: CloudflareEnv = cfEnv ?? {
      ARENA_TOKEN: process.env.ARENA_TOKEN ?? import.meta.env.ARENA_TOKEN,
      PAYLOAD_URL: process.env.PAYLOAD_URL ?? import.meta.env.PAYLOAD_URL,
      DATABASE_URL: process.env.DATABASE_URL ?? import.meta.env.DATABASE_URL,
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? import.meta.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ?? import.meta.env.TELEGRAM_CHAT_ID,
      NODE_ENV: process.env.NODE_ENV ?? "development",
    };

    event.nativeEvent.context.effectLayer = createServicesLayer(env);
  },
});

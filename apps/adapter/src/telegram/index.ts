import { Elysia } from "elysia";
import { postTelegramUpdateRoute } from "./post-telegram-update";

export const telegramIntegration = new Elysia({ name: "telegram" }).use(postTelegramUpdateRoute);

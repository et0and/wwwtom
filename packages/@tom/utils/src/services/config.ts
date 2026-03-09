import { Context, Layer, Redacted } from "effect";

export interface AppConfigShape {
  readonly arenaToken: Redacted.Redacted<string> | undefined;
  readonly payloadUrl: Redacted.Redacted<string>;
  readonly databaseUrl: Redacted.Redacted<string>;
  readonly telegramBotToken: Redacted.Redacted<string> | undefined;
  readonly telegramChatId: string | undefined;
  readonly isDev: boolean;
}

const parseOptionalSecret = (value?: string): string | undefined => {
  const v = value?.trim();
  if (!v) return undefined;
  const lower = v.toLowerCase();
  if (lower === "undefined" || lower === "null") return undefined;
  return v;
};

export class AppConfig extends Context.Tag("AppConfig")<AppConfig, AppConfigShape>() {}

export type CloudflareEnv = {
  ARENA_TOKEN?: string;
  PAYLOAD_URL?: string;
  DATABASE_URL?: string;
  HYPERDRIVE?: { connectionString: string };
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  SUCCESS_URL?: string;
  POLAR_ACCESS_TOKEN?: string;
  NODE_ENV?: string;
};

export const makeAppConfigLayer = (env: CloudflareEnv): Layer.Layer<AppConfig> =>
  Layer.succeed(
    AppConfig,
    (() => {
      const arenaToken = parseOptionalSecret(env.ARENA_TOKEN);
      return {
        arenaToken: arenaToken ? Redacted.make(arenaToken) : undefined,
        payloadUrl: Redacted.make(env.PAYLOAD_URL ?? ""),
        databaseUrl: Redacted.make(env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL ?? ""),
        telegramBotToken: env.TELEGRAM_BOT_TOKEN
          ? Redacted.make(env.TELEGRAM_BOT_TOKEN)
          : undefined,
        telegramChatId: env.TELEGRAM_CHAT_ID,
        isDev: env.NODE_ENV !== "production",
      };
    })(),
  );

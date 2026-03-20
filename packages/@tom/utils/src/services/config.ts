import { Effect, Layer, Redacted } from "effect";

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

export class AppConfig extends Effect.Service<AppConfig>()("AppConfig", {
  accessors: true,
  succeed: {
    arenaToken: undefined as Redacted.Redacted<string> | undefined,
    payloadUrl: Redacted.make(""),
    databaseUrl: Redacted.make(""),
    telegramBotToken: undefined as Redacted.Redacted<string> | undefined,
    telegramChatId: undefined as string | undefined,
    isDev: true as boolean,
  },
}) {
  static fromEnv(env: CloudflareEnv): Layer.Layer<AppConfig> {
    const arenaToken = parseOptionalSecret(env.ARENA_TOKEN);
    return Layer.succeed(AppConfig, {
      _tag: "AppConfig",
      arenaToken: arenaToken ? Redacted.make(arenaToken) : undefined,
      payloadUrl: Redacted.make(env.PAYLOAD_URL ?? ""),
      databaseUrl: Redacted.make(env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL ?? ""),
      telegramBotToken: env.TELEGRAM_BOT_TOKEN ? Redacted.make(env.TELEGRAM_BOT_TOKEN) : undefined,
      telegramChatId: env.TELEGRAM_CHAT_ID,
      isDev: env.NODE_ENV !== "production",
    });
  }
}

/**
 * Create a config layer from a partial config object.
 * Useful for testing and API routes that only need subset of config.
 */
export const makeAppConfigLayer = (
  config: Partial<{
    ARENA_TOKEN: string;
    PAYLOAD_URL: string;
    DATABASE_URL: string;
    TELEGRAM_BOT_TOKEN: string;
    TELEGRAM_CHAT_ID: string;
    NODE_ENV: string;
  }>,
): Layer.Layer<AppConfig> => {
  return Layer.succeed(AppConfig, {
    _tag: "AppConfig",
    arenaToken: config.ARENA_TOKEN ? Redacted.make(config.ARENA_TOKEN) : undefined,
    payloadUrl: Redacted.make(config.PAYLOAD_URL ?? ""),
    databaseUrl: Redacted.make(config.DATABASE_URL ?? ""),
    telegramBotToken: config.TELEGRAM_BOT_TOKEN
      ? Redacted.make(config.TELEGRAM_BOT_TOKEN)
      : undefined,
    telegramChatId: config.TELEGRAM_CHAT_ID,
    isDev: config.NODE_ENV !== "production",
  });
};

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
  TOM_SECRETS?: { get(): Promise<string> };
};

const secretKeys = [
  "ARENA_TOKEN",
  "PAYLOAD_URL",
  "DATABASE_URL",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "SUCCESS_URL",
  "POLAR_ACCESS_TOKEN",
] as const;

export const readCloudflareEnv = async (env: CloudflareEnv): Promise<CloudflareEnv> => {
  if (!env.TOM_SECRETS) return env;

  const parsed: unknown = JSON.parse(await env.TOM_SECRETS.get());
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("TOM_SECRETS must be a JSON object");
  }

  const bundle = Object.fromEntries(
    secretKeys.flatMap((key) => {
      const value = (parsed as Record<string, unknown>)[key];
      return typeof value === "string" ? [[key, value]] : [];
    }),
  );

  return { ...env, ...bundle };
};

export class AppConfig extends Context.Service<AppConfig, AppConfigShape>()("AppConfig") {
  static readonly Default = Layer.succeed(AppConfig, {
    arenaToken: undefined as Redacted.Redacted<string> | undefined,
    payloadUrl: Redacted.make(""),
    databaseUrl: Redacted.make(""),
    telegramBotToken: undefined as Redacted.Redacted<string> | undefined,
    telegramChatId: undefined as string | undefined,
    isDev: true as boolean,
  });

  static fromEnv(env: CloudflareEnv): Layer.Layer<AppConfig> {
    return makeAppConfigLayer(env);
  }
}

/**
 * Create a config layer from a partial config object.
 * Useful for testing and API routes that only need subset of config.
 */
export const makeAppConfigLayer = (config: Partial<CloudflareEnv>): Layer.Layer<AppConfig> => {
  const arenaToken = parseOptionalSecret(config.ARENA_TOKEN);
  return Layer.succeed(AppConfig, {
    arenaToken: arenaToken ? Redacted.make(arenaToken) : undefined,
    payloadUrl: Redacted.make(config.PAYLOAD_URL ?? ""),
    databaseUrl: Redacted.make(config.HYPERDRIVE?.connectionString ?? config.DATABASE_URL ?? ""),
    telegramBotToken: config.TELEGRAM_BOT_TOKEN
      ? Redacted.make(config.TELEGRAM_BOT_TOKEN)
      : undefined,
    telegramChatId: config.TELEGRAM_CHAT_ID,
    isDev: config.NODE_ENV !== "production",
  });
};

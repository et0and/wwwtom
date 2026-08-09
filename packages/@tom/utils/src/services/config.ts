import { Context, Effect, Layer, Redacted, Schema } from "effect";
import { TomSecretsSchema } from "@tom/schemas/secrets";
import { SecretsError } from "@tom/types/errors";

export interface AppConfigShape {
  readonly arenaToken: Redacted.Redacted<string> | undefined;
  readonly arenaBaseUrl: string | undefined;
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

export type KvNamespaceLike = {
  readonly get: (key: string) => Promise<string | null>;
  readonly put: (
    key: string,
    value: string,
    options?: { readonly expirationTtl?: number },
  ) => Promise<void>;
};

export type CloudflareEnv = {
  ARENA_TOKEN?: string;
  ARENA_API_URL?: string;
  PAYLOAD_URL?: string;
  DATABASE_URL?: string;
  HYPERDRIVE?: { connectionString: string };
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  SUCCESS_URL?: string;
  POLAR_ACCESS_TOKEN?: string;
  POLAR_API_URL?: string;
  ADAPTER_URL?: string;
  API_URL?: string;
  GUESTBOOK_RETURN_URL?: string;
  ADDRESS_DB?: string;
  ADDRESS_ADMIN_KEY?: string;
  ADDRESS_LINZ_API_KEY?: string;
  ADDRESS_API_KEY_SALT?: string;
  ADDRESS_POW_SECRET?: string;
  TOM_RATE_LIMIT_KV?: KvNamespaceLike;
  NODE_ENV?: string;
  LOG_LEVEL?: string;
  OTEL_ENDPOINT?: string;
  AXIOM_TOKEN?: string;
  OTEL_TRACES_DATASET?: string;
  OTEL_LOGS_DATASET?: string;
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
  "ADDRESS_DB",
  "ADDRESS_ADMIN_KEY",
  "ADDRESS_LINZ_API_KEY",
  "ADDRESS_API_KEY_SALT",
  "ADDRESS_POW_SECRET",
  "OTEL_ENDPOINT",
  "AXIOM_TOKEN",
  "OTEL_TRACES_DATASET",
  "OTEL_LOGS_DATASET",
] as const;

export const readCloudflareEnv = async (env: CloudflareEnv): Promise<CloudflareEnv> => {
  if (!env.TOM_SECRETS) return env;

  const raw = await env.TOM_SECRETS.get();
  const parsed = Effect.runSync(
    Effect.try({
      try: () => Schema.decodeUnknownSync(TomSecretsSchema)(raw),
      catch: (cause) =>
        new SecretsError({
          message: "TOM_SECRETS must be a JSON object of string values",
          cause,
        }),
    }),
  );

  const bundle = Object.fromEntries(
    secretKeys.flatMap((key) => {
      const value = parsed[key];
      return value === undefined ? [] : [[key, value]];
    }),
  );

  return { ...env, ...bundle };
};

export class AppConfig extends Context.Service<AppConfig, AppConfigShape>()("AppConfig") {
  static readonly Default = Layer.succeed(AppConfig, {
    arenaToken: undefined as Redacted.Redacted<string> | undefined,
    arenaBaseUrl: undefined as string | undefined,
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

export type PartialCloudflareEnv = {
  [K in keyof CloudflareEnv]?: CloudflareEnv[K] | undefined;
};

/**
 * Create a config layer from a partial config object.
 * Useful for testing and API routes that only need subset of config.
 */
export const makeAppConfigLayer = (config: PartialCloudflareEnv): Layer.Layer<AppConfig> => {
  const arenaToken = parseOptionalSecret(config.ARENA_TOKEN);
  const arenaBaseUrl = parseOptionalSecret(config.ARENA_API_URL);
  return Layer.succeed(AppConfig, {
    arenaToken: arenaToken ? Redacted.make(arenaToken) : undefined,
    arenaBaseUrl,
    payloadUrl: Redacted.make(config.PAYLOAD_URL ?? ""),
    databaseUrl: Redacted.make(config.HYPERDRIVE?.connectionString ?? config.DATABASE_URL ?? ""),
    telegramBotToken: config.TELEGRAM_BOT_TOKEN
      ? Redacted.make(config.TELEGRAM_BOT_TOKEN)
      : undefined,
    telegramChatId: config.TELEGRAM_CHAT_ID,
    isDev: config.NODE_ENV !== "production",
  });
};

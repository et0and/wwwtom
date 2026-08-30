import { Context, Effect, Layer, Redacted, Schema } from "effect";
import { TomSecretsSchema } from "@tom/schemas/secrets";
import type { TomWorkMessageEncoded } from "@tom/schemas/queue";
import { SecretsError } from "@tom/types/errors";
import type { FlagshipBinding } from "@tom/flags/binding";

export interface AppConfigContract {
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

export type SecretBinding = {
  get(): Promise<string>;
};

// AXIOM_TOKEN is either a plain string (local dev, tests) or a Cloudflare
// Secrets Store binding (production; minted by the Axiom provider). Decode
// the union at the env boundary instead of narrowing with typeof. The
// binding is modeled as any object, not a Struct — Struct rejects unknown
// keys in this Effect version and the platform binding carries properties
// beyond `get`.
const SecretSourceSchema = Schema.Union([Schema.String, Schema.instanceOf(Object)]);

export const resolveSecretValue = (
  value: string | SecretBinding | undefined,
): Promise<string | undefined> => {
  if (value === undefined) return Promise.resolve(undefined);
  Schema.decodeUnknownSync(SecretSourceSchema)(value);
  return Schema.is(Schema.String)(value) ? Promise.resolve(value) : value.get();
};

export type CloudflareEnv = {
  ARENA_TOKEN?: string;
  ARENA_API_URL?: string;
  PAYLOAD_URL?: string;
  DATABASE_URL?: string;
  HYPERDRIVE?: { connectionString: string };
  // Raw Cloudflare queue binding — app code should go through
  // TomQueueService (@tom/utils/services/queue) for schema-typed sends.
  WORK_QUEUE?: {
    send(body: TomWorkMessageEncoded, options?: { contentType?: "json" | "text" }): Promise<void>;
    sendBatch(
      messages: ReadonlyArray<{
        body: TomWorkMessageEncoded;
        contentType?: "json" | "text";
      }>,
    ): Promise<void>;
  };
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  SUCCESS_URL?: string;
  POLAR_ACCESS_TOKEN?: string;
  POLAR_API_URL?: string;
  INTERNAL_API_TOKEN?: string;
  ADAPTER_URL?: string;
  API_URL?: string;
  GUESTBOOK_RETURN_URL?: string;
  // Cloudflare Flagship feature-flag binding, wired into the api worker in
  // infra/apps/api.run.ts. Routes evaluate flags through
  // Flags.Binding(env.FLAGS) from @tom/flags/service; absent in test.
  FLAGS?: FlagshipBinding;
  // When set, requests carrying the `x-use-simulator` header have their
  // upstream service URLs (payload/arena/polar/api) rewritten to this base
  // URL — the e2e fixture simulator (apps/simulator).
  SIMULATOR_URL?: string;
  NODE_ENV?: string;
  LOG_LEVEL?: string;
  // Axiom OTLP ingest token: a Secrets Store binding in production (minted
  // by the Axiom provider in infra/shared.run.ts), a plain string in local
  // dev / tests. Resolved to a string by readCloudflareEnv.
  AXIOM_TOKEN?: string | SecretBinding;
  // Optional overrides; default to Axiom cloud + tom-traces/tom-logs in
  // otelConfigFromResolvedEnv.
  OTEL_ENDPOINT?: string;
  OTEL_TRACES_DATASET?: string;
  OTEL_LOGS_DATASET?: string;
  TOM_SECRETS?: { get(): Promise<string> };
};

// Keys seeded into the TOM_SECRETS bundle. AXIOM_TOKEN and the OTEL_*
// overrides are deliberately absent: the ingest token is an IaC-minted
// Secrets Store secret (see infra/shared.run.ts) and the OTLP endpoint +
// dataset names default in otelConfigFromResolvedEnv.
const secretKeys = [
  "ARENA_TOKEN",
  "PAYLOAD_URL",
  "DATABASE_URL",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "SUCCESS_URL",
  "POLAR_ACCESS_TOKEN",
  "INTERNAL_API_TOKEN",
  "GITHUB_TOKEN",
  "CONTROL_TOKEN",
] as const;

export type ResolvedCloudflareEnv = CloudflareEnv & { AXIOM_TOKEN?: string };

export const readCloudflareEnv = async (env: CloudflareEnv): Promise<ResolvedCloudflareEnv> => {
  const { AXIOM_TOKEN: axiomBinding, ...rest } = env;
  const axiomToken = await resolveSecretValue(axiomBinding);
  if (!env.TOM_SECRETS) {
    return axiomToken ? { ...rest, AXIOM_TOKEN: axiomToken } : rest;
  }

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

  return { ...rest, ...bundle, ...(axiomToken && { AXIOM_TOKEN: axiomToken }) };
};

export class AppConfig extends Context.Service<AppConfig, AppConfigContract>()("AppConfig") {
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

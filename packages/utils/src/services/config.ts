import { Context, Effect, Layer, Redacted, Schema } from "effect";
import { TomSecretsSchema } from "@tom/schemas/secrets";
import type { TomWorkMessageEncoded } from "@tom/schemas/queue";
import { SecretsError } from "@tom/types/errors";

export interface AppConfigContract {
  readonly arenaToken: Redacted.Redacted<string> | undefined;
  readonly arenaBaseUrl: string | undefined;
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

// Minimal Worker-safe D1 surface used by CmsService (apps/api). The real
// D1Database binding satisfies this structurally; tests fake it.
export interface CmsD1Statement {
  readonly bind: (...values: ReadonlyArray<string | number | null>) => CmsD1Statement;
  readonly first: <T>(column?: string) => Promise<T | null>;
  readonly all: <T>() => Promise<{ readonly results: ReadonlyArray<T> }>;
  readonly run: () => Promise<{ readonly success: boolean }>;
}

export interface CmsD1Binding {
  readonly prepare: (query: string) => CmsD1Statement;
  // Batch + exec exist on the real D1 binding; Better Auth detects and
  // uses them, CmsService only uses prepare.
  readonly batch: (
    statements: ReadonlyArray<CmsD1Statement>,
  ) => Promise<ReadonlyArray<{ readonly success: boolean }>>;
  readonly exec: (query: string) => Promise<unknown>;
}

// Minimal Worker-safe R2 surface used by CmsService. The real R2Bucket
// binding satisfies this structurally; tests fake it.
export interface CmsR2Object {
  readonly key: string;
  readonly size: number;
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
}

export interface CmsR2Binding {
  readonly put: (
    key: string,
    value: ArrayBuffer | Uint8Array | string,
    options?: { readonly httpMetadata?: { readonly contentType?: string } },
  ) => Promise<{ readonly key: string }>;
  readonly get: (key: string) => Promise<CmsR2Object | null>;
  readonly delete: (key: string) => Promise<void>;
}

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
  // Public origin of the CMS editor SPA; trusted for OAuth callbacks.
  EDITOR_URL?: string;
  GUESTBOOK_RETURN_URL?: string;
  // Slim CMS auth (Better Auth + GitHub OAuth), owned by the api stack.
  BETTER_AUTH_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  // Google OAuth for Sophie CMS. Tom CMS uses GitHub only; Sophie CMS uses
  // Google only. Shared auth code reads both and enables each when present.
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  // Tenant tag isolating the Tom and Sophie deployments ("tom" |
  // "sophie"). Set per worker in infra (api + adapter run files); runtime
  // code selects tenant-scoped origins and per-tenant bundle keys from it.
  // Unset preserves the legacy shared behavior.
  TENANT?: string;
  // Comma-separated OAuth provider allowlist ("github", "google") enforced
  // by createAuthFromEnv. Set per API worker in infra (Tom: github, Sophie:
  // google); unset preserves the legacy enable-when-configured behavior.
  CMS_AUTH_PROVIDERS?: string;
  // Comma-separated admin emails allowed to sign in. Worker bindings only
  // carry strings, so callers read the parsed string[] via parseAdminEmails.
  CMS_ADMIN_EMAILS?: string;
  // Slim CMS storage bindings (D1 tables + R2 media bucket), owned by the
  // api stack (infra/cms/cms.storage.ts). Only the API binds them.
  CMS_D1?: CmsD1Binding;
  CMS_MEDIA?: CmsR2Binding;
  // When set, requests carrying the `x-use-simulator` header have their
  // upstream service URLs (arena/polar/api) rewritten to this base
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
  // Alchemy stage (dev, staging, production, pr-*) for environment labels
  // in Telegram error alerts. Set by the infra run files, not a secret.
  TOM_STAGE?: string;
  TOM_SECRETS?: { get(): Promise<string> };
};

// Keys seeded into the TOM_SECRETS bundle. AXIOM_TOKEN and the OTEL_*
// overrides are deliberately absent: the ingest token is an IaC-minted
// Secrets Store secret (see infra/shared.run.ts) and the OTLP endpoint +
// dataset names default in otelConfigFromResolvedEnv.
const secretKeys = [
  "ARENA_TOKEN",
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "CMS_ADMIN_EMAILS",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "SUCCESS_URL",
  "POLAR_ACCESS_TOKEN",
  "INTERNAL_API_TOKEN",
  "GITHUB_TOKEN",
  "CONTROL_TOKEN",
  "TURBO_CACHE_TOKEN",
  "TURBO_CACHE_SIGNATURE_KEY",
] as const;

export type ResolvedCloudflareEnv = CloudflareEnv & { AXIOM_TOKEN?: string };

/** Parse the comma-separated admin allowlist into a string[]. */
export const parseAdminEmails = (value: string | undefined): Array<string> =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const TENANT_PREFIXES = { tom: "TOM_", sophie: "SOPHIE_" } as const;

/** Bundle-key prefix for a tenant tag. Unknown tags select nothing. */
const tenantPrefix = (tenant: string | undefined): "TOM_" | "SOPHIE_" | undefined =>
  tenant === "tom" || tenant === "sophie" ? TENANT_PREFIXES[tenant] : undefined;

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
      // The admin allowlist resolves separately below (tenant-aware), so
      // the shared bundle value never leaks into the spread.
      if (key === "CMS_ADMIN_EMAILS") return [];
      const value = parsed[key];
      return value === undefined ? [] : [[key, value]];
    }),
  );

  const prefix = tenantPrefix(rest.TENANT);
  const tenantValue = (name: string): string | undefined =>
    prefix === undefined ? undefined : parsed[`${prefix}${name}`];
  const tenantAuthSecret = tenantValue("BETTER_AUTH_SECRET");
  const tenantInternalToken = tenantValue("INTERNAL_API_TOKEN");
  const tenantAdmins = tenantValue("CMS_ADMIN_EMAILS");
  // Stage config stays authoritative for the admin allowlist: an explicitly
  // set worker env wins over the bundle (which is opaque and shared), so a
  // stale bundle value can never lock every admin out. Per-tenant bundle
  // keys win over the shared key next; unset keeps the shared value —
  // except Sophie, which never inherits the shared allowlist (that would
  // grant Tom admins Sophie access). An empty allowlist fails closed
  // downstream: no Allowlisted email can sign in or write.
  const adminEmails =
    rest.CMS_ADMIN_EMAILS ??
    tenantAdmins ??
    (prefix === "SOPHIE_" ? undefined : parsed.CMS_ADMIN_EMAILS);

  // Explicit worker env wins over the opaque bundle for provider keys:
  // stage config is the only deploy-time guarantee when the store value
  // is unreadable, so a stale bundle can never silently break a worker.
  type ExplicitProviderSecrets = {
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
  };
  const explicitProviderSecrets: ExplicitProviderSecrets = {};
  if (rest.GOOGLE_CLIENT_ID) explicitProviderSecrets.GOOGLE_CLIENT_ID = rest.GOOGLE_CLIENT_ID;
  if (rest.GOOGLE_CLIENT_SECRET)
    explicitProviderSecrets.GOOGLE_CLIENT_SECRET = rest.GOOGLE_CLIENT_SECRET;

  return {
    ...rest,
    ...bundle,
    ...explicitProviderSecrets,
    // Per-tenant bundle keys (TOM_*/SOPHIE_*) let each tenant rotate its
    // secrets independently; unset tenant keys fall back to the shared
    // value so existing deploys keep working.
    ...(tenantAuthSecret !== undefined && { BETTER_AUTH_SECRET: tenantAuthSecret }),
    ...(tenantInternalToken !== undefined && { INTERNAL_API_TOKEN: tenantInternalToken }),
    ...(adminEmails !== undefined && { CMS_ADMIN_EMAILS: adminEmails }),
    ...(axiomToken && { AXIOM_TOKEN: axiomToken }),
  };
};

export class AppConfig extends Context.Service<AppConfig, AppConfigContract>()("AppConfig") {
  static readonly Default = Layer.succeed(AppConfig, {
    arenaToken: undefined as Redacted.Redacted<string> | undefined,
    arenaBaseUrl: undefined as string | undefined,
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
    databaseUrl: Redacted.make(config.HYPERDRIVE?.connectionString ?? config.DATABASE_URL ?? ""),
    telegramBotToken: config.TELEGRAM_BOT_TOKEN
      ? Redacted.make(config.TELEGRAM_BOT_TOKEN)
      : undefined,
    telegramChatId: config.TELEGRAM_CHAT_ID,
    isDev: config.NODE_ENV !== "production",
  });
};

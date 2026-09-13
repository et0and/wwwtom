import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { Effect } from "effect";
import { CmsError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import type { CloudflareEnv, CmsD1Binding } from "@tom/utils/services/config";
import { parseAdminEmails } from "@tom/utils/services/config";

export type AuthDatabase = CmsD1Binding | ReturnType<typeof memoryAdapter>;

export type MemorySeedRow = Record<string, string | number | boolean | Date | null>;

/** In-memory database for tests (same Better Auth behavior, no D1). */
export const memoryDatabase = (seed: Record<string, Array<MemorySeedRow>> = {}): AuthDatabase =>
  memoryAdapter(seed);

/** Admin allowlist check (case-insensitive, whitespace-tolerant). */
export const isAdminEmail = (email: string, allowlist: ReadonlyArray<string>): boolean =>
  allowlist
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0)
    .includes(email.trim().toLowerCase());

export type OAuthProvider = {
  readonly clientId: string;
  readonly clientSecret: string;
};

export type CreateAuthOptions = {
  readonly database: AuthDatabase;
  readonly secret: string;
  readonly baseURL: string;
  readonly trustedOrigins: ReadonlyArray<string>;
  readonly github?: OAuthProvider;
  readonly google?: OAuthProvider;
  readonly adminEmails: ReadonlyArray<string>;
};

/**
 * Better Auth instance for the CMS. Built per request from the worker env
 * (Bindings are request-scoped in Workers, so no module-level instance).
 * Browsers reach it through the adapter `/auth/*` proxy; the public baseURL
 * is the adapter origin so OAuth redirects stay on one domain.
 */
export const createAuth = (options: CreateAuthOptions) => {
  const adminEmails = options.adminEmails;
  return betterAuth({
    appName: "tom-cms",
    baseURL: options.baseURL,
    basePath: "/auth",
    secret: options.secret,
    trustedOrigins: [...options.trustedOrigins],
    database: options.database,
    socialProviders: {
      ...(options.github && { github: options.github }),
      ...(options.google && { google: options.google }),
    },
    rateLimit: {
      storage: "database",
    },
    // The editor runs on a sibling origin (cms.tom.so), so session cookies
    // must travel cross-site: SameSite=None requires Secure. Localhost is a
    // trustworthy origin, so browsers still accept these over plain http.
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!isAdminEmail(user.email, adminEmails)) return false;
            return undefined;
          },
        },
      },
    },
  });
};

export type Auth = ReturnType<typeof createAuth>;

/** Provider credentials from worker env. Empty values count as unset. */
const oauthProvider = (
  clientId: string | undefined,
  clientSecret: string | undefined,
): OAuthProvider | undefined =>
  clientId !== undefined && clientId !== "" && clientSecret !== undefined && clientSecret !== ""
    ? { clientId, clientSecret }
    : undefined;

const AUTH_PROVIDERS = ["github", "google"] as const;

export type CmsAuthProvider = (typeof AUTH_PROVIDERS)[number];

/**
 * Parse the comma-separated CMS_AUTH_PROVIDERS allowlist (infra sets it
 * per worker: Tom "github", Sophie "google"). Unset or blank preserves the
 * legacy enable-when-configured behavior; a set value filters providers,
 * and a value with no known provider fails closed downstream (no OAuth
 * provider configures, so createAuthFromEnv reports auth unconfigured).
 */
export const parseAuthProviders = (
  value: string | undefined,
): ReadonlyArray<CmsAuthProvider> | undefined => {
  if (value === undefined || value.trim() === "") return undefined;
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry): entry is CmsAuthProvider => entry === "github" || entry === "google");
};

/** Provider allowlist check. Unset allowlists keep legacy behavior. */
const providerAllowed = (
  allowlist: ReadonlyArray<CmsAuthProvider> | undefined,
  provider: CmsAuthProvider,
): boolean => allowlist === undefined || allowlist.includes(provider);

/**
 * Preview CMS editor origin patterns (pr-<n>-cms hosts). OAuth redirect
 * URIs are exact-match at Google/GitHub, so infinite preview hosts can
 * never be registered: preview editors authenticate through the dev
 * adapters, whose redirect URIs are registered. better-auth matches these
 * `*` patterns anchored on both ends, so pr-138-cms matches but
 * evil-pr-138-cms and pr-138-cms.evil.com do not. Only our DNS namespace
 * can mint matching hosts. Scoped per tenant; unset without one.
 */
const previewEditorPatterns = (env: CloudflareEnv): ReadonlyArray<string> => {
  if (env.TENANT === "sophie") return ["https://pr-*-cms.sophie.st"];
  if (env.TENANT === "tom") return ["https://pr-*-cms.tom.so"];
  return [];
};

/** Build an auth instance from worker env. Fails closed when unset. */
export const createAuthFromEnv = Effect.fn("Auth.fromEnv")(function* (env: CloudflareEnv) {
  const database = env.CMS_D1;
  const secret = env.BETTER_AUTH_SECRET?.trim();
  // Belt-and-braces tenant isolation: even if the other tenant's OAuth
  // keys leak into this worker's env, the allowlist keeps them disabled.
  const allowlist = parseAuthProviders(env.CMS_AUTH_PROVIDERS);
  const github = providerAllowed(allowlist, "github")
    ? oauthProvider(env.GITHUB_CLIENT_ID?.trim(), env.GITHUB_CLIENT_SECRET?.trim())
    : undefined;
  const google = providerAllowed(allowlist, "google")
    ? oauthProvider(env.GOOGLE_CLIENT_ID?.trim(), env.GOOGLE_CLIENT_SECRET?.trim())
    : undefined;
  if (!database || !secret || (github === undefined && google === undefined)) {
    return yield* new CmsError({
      message: "CMS auth not configured",
      status: HttpStatus.InternalServerError,
      operation: "auth_config",
    });
  }
  const adapterUrl = env.ADAPTER_URL ?? "http://localhost:8788";
  const editorUrl = env.EDITOR_URL ?? "http://localhost:5173";
  return yield* Effect.try({
    try: () =>
      createAuth({
        database,
        secret,
        baseURL: adapterUrl,
        trustedOrigins: [adapterUrl, editorUrl, ...previewEditorPatterns(env)],
        ...(github && { github }),
        ...(google && { google }),
        adminEmails: parseAdminEmails(env.CMS_ADMIN_EMAILS),
      }),
    catch: (cause) =>
      new CmsError({
        message: "Failed to initialize authentication",
        status: HttpStatus.InternalServerError,
        operation: "auth_config",
        cause,
      }),
  });
});

/** Load the Better Auth session for request headers; 401 when absent. */
export const requireSession = Effect.fn("Auth.requireSession")(function* (
  auth: Auth,
  headers: Headers,
) {
  const session = yield* Effect.tryPromise({
    try: () => auth.api.getSession({ headers }),
    catch: (cause) =>
      new CmsError({
        message: "Failed to load session",
        status: HttpStatus.InternalServerError,
        operation: "get_session",
        cause,
      }),
  });
  if (!session) {
    return yield* new CmsError({
      message: "Unauthorized",
      status: HttpStatus.Unauthorized,
      operation: "get_session",
    });
  }
  return { user: session.user, session: session.session };
});

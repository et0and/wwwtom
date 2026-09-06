import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { Effect } from "effect";
import { CmsError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import type { CloudflareEnv, CmsD1Binding } from "@tom/utils/services/config";

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

export type CreateAuthOptions = {
  readonly database: AuthDatabase;
  readonly secret: string;
  readonly baseURL: string;
  readonly trustedOrigins: ReadonlyArray<string>;
  readonly githubClientId: string;
  readonly githubClientSecret: string;
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
      github: {
        clientId: options.githubClientId,
        clientSecret: options.githubClientSecret,
      },
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

/** Build an auth instance from worker env. Fails closed when unset. */
export const createAuthFromEnv = Effect.fn("Auth.fromEnv")(function* (env: CloudflareEnv) {
  const database = env.CMS_D1;
  const secret = env.BETTER_AUTH_SECRET?.trim();
  const githubClientId = env.GITHUB_CLIENT_ID?.trim();
  const githubClientSecret = env.GITHUB_CLIENT_SECRET?.trim();
  if (!database || !secret || !githubClientId || !githubClientSecret) {
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
        trustedOrigins: [adapterUrl, editorUrl],
        githubClientId,
        githubClientSecret,
        adminEmails: (env.CMS_ADMIN_EMAILS ?? "").split(","),
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

export type AuthSession = {
  readonly user: Auth["$Infer"]["Session"]["user"];
  readonly session: Auth["$Infer"]["Session"]["session"];
};

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

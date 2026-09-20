import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { Effect } from "effect";
import { Stage } from "alchemy/Stage";
import * as Cloudflare from "alchemy/Cloudflare";
import { AuthenticationError, SecretsError } from "@tom/types/errors";
import {
  isAdminEmail,
  parseAdminEmails,
  readCloudflareEnv,
  type CloudflareEnv,
  type CmsD1Binding,
} from "@tom/utils/services/config";

/** Worker env surface the Git host reads (bindings + the secret bundle). */
export type GitEnv = CloudflareEnv & {
  readonly GIT_AUTH_D1?: CmsD1Binding;
};

/** Account + credential storage for the Git host (migrations in ../migrations). */
export const GitAuthDb = Cloudflare.D1.Database("GitAuthDb", {
  name: Effect.gen(function* () {
    const stage = yield* Stage;
    return stage === "production" ? "wwwtom-git-auth" : `wwwtom-git-auth-${stage}`;
  }),
  migrations: `${import.meta.dirname}/../migrations`,
});

type OAuthProvider = {
  readonly clientId: string;
  readonly clientSecret: string;
};

type CreateGitAuthOptions = {
  readonly database: CmsD1Binding;
  readonly secret: string;
  readonly baseURL: string;
  readonly github: OAuthProvider;
  readonly adminEmails: ReadonlyArray<string>;
};

/**
 * Better Auth for the Git host: GitHub sign-in for browsers, plus per-user
 * API keys sent as the HTTP Basic password by `git` clients. Built per
 * request from the worker env, since bindings are request-scoped in Workers.
 */
export const createGitAuth = (options: CreateGitAuthOptions) =>
  betterAuth({
    appName: "tom-git",
    baseURL: options.baseURL,
    basePath: "/api/auth",
    secret: options.secret,
    database: options.database,
    trustedOrigins: [options.baseURL],
    socialProviders: { github: options.github },
    // A clone or push makes many authenticated requests; the plugin's
    // default of ten per day is too small for a Git client.
    plugins: [apiKey({ rateLimit: { timeWindow: 60_000, maxRequests: 1_000 } })],
    databaseHooks: {
      user: {
        create: {
          before: async (user) =>
            isAdminEmail(user.email, options.adminEmails) ? undefined : false,
        },
      },
    },
  });

export type GitAuth = ReturnType<typeof createGitAuth>;

/** Provider credentials from the resolved env. Empty values count as unset. */
const oauthProvider = (
  clientId: string | undefined,
  clientSecret: string | undefined,
): OAuthProvider | undefined =>
  clientId !== undefined && clientId !== "" && clientSecret !== undefined && clientSecret !== ""
    ? { clientId, clientSecret }
    : undefined;

/** Build the auth instance from worker env; fails closed when unconfigured. */
export const createGitAuthFromEnv = Effect.fn("GitAuth.fromEnv")(function* (
  env: GitEnv,
  baseURL: string,
) {
  const resolved = yield* Effect.tryPromise({
    try: () => readCloudflareEnv(env),
    catch: (cause) =>
      new SecretsError({
        message: "Failed to resolve the TOM_SECRETS bundle",
        cause,
      }),
  });
  const database = env.GIT_AUTH_D1;
  const secret = resolved.BETTER_AUTH_SECRET?.trim();
  const github = oauthProvider(
    resolved.GITHUB_CLIENT_ID?.trim(),
    resolved.GITHUB_CLIENT_SECRET?.trim(),
  );
  const adminEmails = parseAdminEmails(resolved.CMS_ADMIN_EMAILS);
  if (
    database === undefined ||
    secret === undefined ||
    secret === "" ||
    github === undefined ||
    adminEmails.length === 0
  ) {
    return yield* new AuthenticationError({
      message:
        "Git auth not configured: GIT_AUTH_D1, BETTER_AUTH_SECRET, GITHUB_CLIENT_ID/SECRET, and CMS_ADMIN_EMAILS must all be set",
    });
  }
  return createGitAuth({ database, secret, baseURL, github, adminEmails });
});

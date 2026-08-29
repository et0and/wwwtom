import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import { admin, organization } from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";
import { sso } from "@better-auth/sso";
import type { D1Database } from "@cloudflare/workers-types";
import { getRequestEnv } from "@tom/utils/services/worker";
import { readCloudflareEnv } from "@tom/utils/services/config";

import * as schema from "../db/auth-schema";

export type AuthEnv = {
  BETTER_AUTH_SECRET?: string | undefined;
  BETTER_AUTH_URL?: string | undefined;
  GITHUB_CLIENT_ID?: string | undefined;
  GITHUB_CLIENT_SECRET?: string | undefined;
};

export const createAuth = (db: D1Database, env: AuthEnv) => {
  const drizzleDb = drizzle(db, { schema });
  const githubClientId = env.GITHUB_CLIENT_ID;
  const githubClientSecret = env.GITHUB_CLIENT_SECRET;

  return betterAuth({
    appName: "tom.so",
    baseURL: env.BETTER_AUTH_URL ?? "http://localhost:8787",
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(drizzleDb, {
      provider: "sqlite",
    }),
    emailAndPassword: {
      enabled: true,
    },
    socialProviders:
      githubClientId && githubClientSecret
        ? {
            github: {
              clientId: githubClientId,
              clientSecret: githubClientSecret,
            },
          }
        : undefined,
    plugins: [
      organization(),
      admin(),
      apiKey({
        requireName: true,
        enableMetadata: true,
        defaultPrefix: "tms_",
      }),
      sso(),
    ] as never[],
    onAPIError: { throw: true },
    trustedOrigins: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://tom.so",
      "https://*.tom.so",
    ],
  });
};

export type Auth = ReturnType<typeof createAuth>;

let authCache: Auth | null = null;

/**
 * Per-request auth instance bound to the request's D1 binding and resolved
 * TOM_SECRETS bundle. Cached per worker; the binding is stable.
 */
export const authFromRequest = async (request: Request): Promise<Auth | null> => {
  if (authCache) return authCache;
  const env = await readCloudflareEnv(getRequestEnv(request));
  const binding = env.AUTH_DB;
  if (!binding) return null;
  authCache = createAuth(binding, {
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    GITHUB_CLIENT_ID: env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: env.GITHUB_CLIENT_SECRET,
  });
  return authCache;
};

export const auth = createAuth({} as D1Database, {
  BETTER_AUTH_SECRET: "cli-generate-placeholder-32-chars-minimum",
  BETTER_AUTH_URL: "http://localhost:8787",
});
export default auth;

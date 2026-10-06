import { Elysia } from "elysia";
import { Effect } from "effect";
import { CmsError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import { readCloudflareEnv } from "@tom/utils/config";
import { getRequestEnv, logContextFromRequest, runEffect } from "@tom/utils/worker";
import { createAuthFromEnv } from "./operations";

/**
 * Better Auth endpoints (OAuth flow, session). Browsers reach them through
 * the adapter `/auth/*` proxy, which attaches the internal token — these
 * routes live inside the token-guarded group in index.ts. The public baseURL
 * is the adapter origin, so OAuth redirects stay on one cookie domain.
 */
export const handleAuthRoute = new Elysia().all("/auth/*", ({ request }) =>
  runEffect(
    Effect.tryPromise({
      try: () => readCloudflareEnv(getRequestEnv(request)),
      catch: (cause) =>
        new CmsError({
          message: "Failed to load configuration",
          status: HttpStatus.InternalServerError,
          operation: "auth_config",
          cause,
        }),
    }).pipe(
      Effect.flatMap((env) => createAuthFromEnv(env)),
      Effect.flatMap((auth) =>
        Effect.tryPromise({
          try: () => auth.handler(request),
          catch: (cause) =>
            new CmsError({
              message: "Authentication failed",
              status: HttpStatus.InternalServerError,
              operation: "auth_handler",
              cause,
            }),
        }),
      ),
    ),
    logContextFromRequest(request, "tom-api"),
  ),
);

import { Elysia } from "elysia";
import { Effect, Option, Schema } from "effect";
import { DatabaseService } from "@tom/db/service";
import { checkProfanity } from "@tom/utils/profanity";
import { readCloudflareEnv } from "@tom/utils/services/config";
import { getRequestEnv, logContextFromRequest } from "@tom/utils/services/worker";
import type { LogContext } from "@tom/utils/services/logging";
import {
  MissingFieldError,
  ProfanityError,
  AuthenticationError,
  type GuestbookValidationError,
  type OAuthSessionError,
  HttpError,
} from "@tom/types/errors";
import * as auth from "./auth";
import { AdapterError, createDbLayer, runAdapter } from "../../config/effect";
import {
  authUrlResponseSchema,
  callbackQuerySchema,
  errorResponseSchema,
  guestbookSessionCookieSchema,
  guestbookUserCookieSchema,
  handleBodySchema,
  messageBodySchema,
  successResponseSchema,
} from "../../schemas";
import type { CloudflareEnv } from "@tom/utils/services/config";

type GuestbookError =
  | MissingFieldError
  | ProfanityError
  | AuthenticationError
  | GuestbookValidationError
  | OAuthSessionError
  | HttpError;

const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_ACTION = "guestbook-sign";

const TurnstileVerifySchema = Schema.Struct({
  success: Schema.Boolean,
  action: Schema.optional(Schema.String),
  hostname: Schema.optional(Schema.String),
});

/**
 * Hostnames that may legitimately embed the guestbook widget. Subdomains of
 * `tom.so` are covered by the widget's domain registration, so the check is
 * apex + subdomains + the local-dev hostnames.
 */
const isExpectedTurnstileHostname = (hostname: string): boolean =>
  hostname === "tom.so" ||
  hostname.endsWith(".tom.so") ||
  hostname === "localhost" ||
  hostname === "127.0.0.1";

/**
 * Verify a Turnstile token against the canonical siteverify endpoint. Fails
 * closed: a missing token, transport error, non-2xx response, malformed
 * body, or action/hostname mismatch all reject the sign. Tokens are
 * single-use — the widget must render fresh before the next attempt.
 */
const verifyTurnstileToken = (
  token: string | undefined,
  secret: string,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    if (!token) return false;

    const response = yield* Effect.tryPromise(() =>
      fetch(TURNSTILE_SITEVERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token }),
        signal: AbortSignal.timeout(10_000),
      }),
    ).pipe(
      Effect.catch(
        Effect.fn("turnstileSiteverifyErrorHandler")(function* (cause: unknown) {
          yield* Effect.logWarning("guestbook:sign:turnstile-siteverify-error", cause);
          return undefined;
        }),
      ),
    );
    if (!response || !response.ok) return false;

    const body = yield* Effect.tryPromise(() => response.json()).pipe(
      Effect.catch(
        Effect.fn("turnstileJsonErrorHandler")(function* () {
          yield* Effect.logWarning("guestbook:sign:turnstile-body-error");
          return undefined as unknown;
        }),
      ),
    );
    const result = Option.getOrNull(Schema.decodeUnknownOption(TurnstileVerifySchema)(body));
    if (!result) return false;

    return (
      result.success === true &&
      result.action === TURNSTILE_ACTION &&
      result.hostname !== undefined &&
      isExpectedTurnstileHostname(result.hostname)
    );
  });

const guestbookStatus = (error: GuestbookError): number => {
  if (error instanceof HttpError) return error.status;
  if (error instanceof AuthenticationError) return 401;
  return 400;
};

const runGuestbook = <T>(
  env: CloudflareEnv,
  effect: Effect.Effect<T, GuestbookError, DatabaseService>,
  context: LogContext,
): Promise<T> =>
  runAdapter(
    Effect.tryPromise(() => readCloudflareEnv(env)).pipe(
      Effect.flatMap((resolved) => effect.pipe(Effect.provide(createDbLayer(resolved)))),
      Effect.mapError((error) =>
        error instanceof HttpError
          ? error
          : new HttpError({ message: error.message, status: 500, cause: error }),
      ),
    ),
    (error) => new AdapterError(guestbookStatus(error), error.message ?? "Bad request"),
    context,
  );

export const userCookieSchema = Schema.fromJsonString(auth.fediverseUserSchema);

export const guestbookIntegration = new Elysia({ name: "guestbook" })
  .get(
    "/guestbook/entries",
    ({ request }) => {
      const env = getRequestEnv(request);
      return runGuestbook(
        env,
        Effect.gen(function* () {
          yield* Effect.logInfo("guestbook:entries:start");
          const db = yield* DatabaseService;
          const data = yield* db.getGuestbookEntries({ page: 1, page_size: 100 });
          yield* Effect.logInfo("guestbook:entries:success");
          return data.results;
        }),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      detail: { description: "List guestbook entries", tags: ["guestbook"] },
    },
  )
  .get(
    "/guestbook/me",
    ({ cookie }) => {
      const userJson = Option.getOrElse(
        Schema.decodeUnknownOption(Schema.String)(cookie.guestbook_user.value),
        () => JSON.stringify(cookie.guestbook_user.value),
      );
      return Option.getOrElse(Schema.decodeUnknownOption(userCookieSchema)(userJson), () => null);
    },
    {
      cookie: guestbookUserCookieSchema,
      detail: {
        description: "Get the signed-in guestbook user from the session cookie",
        tags: ["guestbook"],
      },
    },
  )
  .post(
    "/guestbook/auth/initiate",
    ({ body, cookie, request, set }) => {
      const env = getRequestEnv(request);
      if (!body.handle) {
        set.status = 400;
        return { error: "Missing field: handle" };
      }

      const adapterUrl = env.ADAPTER_URL ?? "http://localhost:8788";
      const redirectUri = `${adapterUrl}/guestbook/callback`;

      return runGuestbook(
        env,
        Effect.gen(function* () {
          yield* Effect.logInfo("guestbook:auth:initiate:start");
          const authResult = yield* auth.initiateAuth(body.handle, redirectUri);
          const finishInitiate = Effect.gen(function* () {
            yield* Effect.sync(() => {
              cookie.guestbook_session.value = authResult.sessionToken;
              cookie.guestbook_session.update({
                maxAge: 15 * 60,
                httpOnly: true,
                secure: env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
              });
            });
            yield* Effect.logInfo("guestbook:auth:initiate:success");
            return { authUrl: authResult.authUrl };
          });
          return yield* finishInitiate.pipe(
            Effect.annotateLogs({ sessionId: authResult.sessionToken }),
          );
        }),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      body: handleBodySchema,
      cookie: guestbookSessionCookieSchema,
      response: {
        200: authUrlResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        500: errorResponseSchema,
      },
      detail: { description: "Start Fediverse OAuth for the guestbook", tags: ["guestbook"] },
    },
  )
  .get(
    "/guestbook/callback",
    ({ query, cookie, request }) => {
      const env = getRequestEnv(request);
      const sessionToken = cookie.guestbook_session.value ?? "";
      const adapterUrl = env.ADAPTER_URL ?? "http://localhost:8788";
      const redirectUri = `${adapterUrl}/guestbook/callback`;
      const returnUrl = env.GUESTBOOK_RETURN_URL ?? "http://localhost:3000/guestbook";

      const callbackProgram = Effect.gen(function* () {
        yield* Effect.logInfo("guestbook:auth:callback:start");
        const user = yield* auth.handleCallback({
          code: query.code,
          session_token: sessionToken,
          redirectUri,
        });
        yield* Effect.sync(() => {
          cookie.guestbook_session.remove();
          cookie.guestbook_user.value = JSON.stringify(user);
          cookie.guestbook_user.update({
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
          });
        });
        yield* Effect.logInfo("guestbook:auth:callback:success");
        return Response.redirect(returnUrl, 302);
      });

      return runGuestbook(
        env,
        callbackProgram.pipe(
          Effect.catch(() =>
            Effect.succeed(Response.redirect(`${returnUrl}?error=auth_failed`, 302)),
          ),
        ),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      query: callbackQuerySchema,
      cookie: guestbookSessionCookieSchema,
      detail: {
        description: "Fediverse OAuth callback — sets the user cookie and redirects back",
        tags: ["guestbook"],
      },
    },
  )
  .post(
    "/guestbook/sign",
    ({ body, cookie, request, set }) => {
      const env = getRequestEnv(request);
      const userJson = Option.getOrElse(
        Schema.decodeUnknownOption(Schema.String)(cookie.guestbook_user.value),
        () => JSON.stringify(cookie.guestbook_user.value),
      );
      const user = Option.getOrElse(
        Schema.decodeUnknownOption(userCookieSchema)(userJson),
        () => null,
      );
      if (!user) {
        set.status = 401;
        return { error: "Not authenticated" };
      }

      return runGuestbook(
        env,
        Effect.gen(function* () {
          yield* Effect.logInfo("guestbook:sign:start");
          if (!body.message) {
            return yield* new MissingFieldError({ field: "message" });
          }

          const profanityCheck = checkProfanity(body.message);
          if (profanityCheck.hasProfanity) {
            return yield* new ProfanityError({
              message:
                profanityCheck.message ?? "Your message contains profanity. Please keep it clean!",
            });
          }

          // Turnstile gates the sign: the web client embeds the widget and
          // sends the token with the request. The secret binding is absent
          // only in local dev / tests — deployed stacks always enforce.
          const turnstileSecret = env.TURNSTILE_SECRET;
          if (turnstileSecret) {
            const verified = yield* verifyTurnstileToken(body.token, turnstileSecret);
            if (!verified) {
              yield* Effect.logWarning("guestbook:sign:turnstile-rejected");
              return yield* new HttpError({
                message: "Verification failed. Please try again.",
                status: 400,
              });
            }
          } else {
            yield* Effect.logWarning("guestbook:sign:turnstile-disabled");
          }

          yield* auth.signGuestbook({ user, message: body.message });
          yield* Effect.logInfo("guestbook:sign:success");
          return { success: true };
        }),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      body: messageBodySchema,
      cookie: guestbookUserCookieSchema,
      response: {
        200: successResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        500: errorResponseSchema,
      },
      detail: { description: "Sign the guestbook (requires the user cookie)", tags: ["guestbook"] },
    },
  )
  .post(
    "/guestbook/logout",
    ({ cookie }) => {
      cookie.guestbook_user.remove();
      cookie.guestbook_session.remove();
      return { success: true };
    },
    {
      cookie: guestbookSessionCookieSchema,
      response: { 200: successResponseSchema },
      detail: { description: "Clear the guestbook cookies", tags: ["guestbook"] },
    },
  );

import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { DatabaseService } from "@tom/db/service";
import { checkProfanity, getRequestEnv, readCloudflareEnv, toErrorMessage } from "@tom/utils";
import {
  MissingFieldError,
  ProfanityError,
  AuthenticationError,
  GuestbookValidationError,
  OAuthSessionError,
  HttpError,
} from "@tom/types";
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
import type { CloudflareEnv } from "@tom/utils";

type GuestbookError =
  | MissingFieldError
  | ProfanityError
  | AuthenticationError
  | GuestbookValidationError
  | OAuthSessionError
  | HttpError;

const guestbookStatus = (error: GuestbookError): number => {
  if (error instanceof HttpError) return error.status;
  if (error instanceof AuthenticationError) return 401;
  return 400;
};

const runGuestbook = <T>(
  env: CloudflareEnv,
  effect: Effect.Effect<T, GuestbookError, DatabaseService>,
): Promise<T> =>
  runAdapter(
    Effect.tryPromise(() => readCloudflareEnv(env)).pipe(
      Effect.flatMap((resolved) => effect.pipe(Effect.provide(createDbLayer(resolved)))),
      Effect.mapError((error) =>
        error instanceof HttpError
          ? error
          : new HttpError({ message: toErrorMessage(error), status: 500 }),
      ),
    ),
    (error) => new AdapterError(guestbookStatus(error), error.message ?? "Bad request"),
  );

const userCookieSchema = Schema.fromJsonString(auth.fediverseUserSchema);

const readUserCookie = (raw: unknown): auth.FediverseUser | null => {
  if (!raw) return null;
  const value = typeof raw === "string" ? raw : JSON.stringify(raw);
  const parsed = Schema.decodeUnknownOption(userCookieSchema)(value);
  return parsed._tag === "Some" ? parsed.value : null;
};

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
      );
    },
    {
      detail: { description: "List guestbook entries", tags: ["guestbook"] },
    },
  )
  .get(
    "/guestbook/me",
    ({ cookie }) => {
      return readUserCookie(cookie.guestbook_user.value);
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
        }),
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
      const user = readUserCookie(cookie.guestbook_user.value);
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

          yield* auth.signGuestbook({ user, message: body.message });
          yield* Effect.logInfo("guestbook:sign:success");
          return { success: true };
        }),
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

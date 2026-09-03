import { Elysia } from "elysia";
import { Effect, Layer, Option, Schema } from "effect";
import { DatabaseService, type GuestbookEntry } from "@tom/db/service";
import { checkProfanity } from "@tom/utils/profanity";
import { makeTomQueueLayer, TomQueueService } from "@tom/utils/services/queue";
import { HttpStatus } from "@tom/constants/http";
import { readCloudflareEnv } from "@tom/utils/services/config";
import {
  getRequestEnv,
  logContextFromRequest,
  toProblemResponse,
} from "@tom/utils/services/worker";
import { ProblemType } from "@tom/constants/problem";
import type { LogContext } from "@tom/utils/services/logging";
import {
  MissingFieldError,
  ProfanityError,
  type AuthenticationError,
  type GuestbookValidationError,
  type OAuthSessionError,
  HttpError,
} from "@tom/types/errors";
import * as auth from "./auth";
import { AdapterError, createDbLayer, runAdapter } from "../../config/effect";
import { isSimulatorRequest } from "../../simulator";
import {
  authUrlResponseSchema,
  callbackQuerySchema,
  problemDetailsSchema,
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

/** A failure from the guestbook flow channel (HttpError or a flow error). */
type GuestbookFlowError = { readonly _tag: string };

/**
 * HTTP status for a guestbook failure. HttpError carries its own status;
 * client-flow failures map to 4xx; anything else (env, database, unknown)
 * stays a 500.
 */
const guestbookStatus = (error: GuestbookFlowError): number => {
  switch (error._tag) {
    case "HttpError":
      return (error as HttpError).status;
    case "AuthenticationError":
      return HttpStatus.Unauthorized;
    case "MissingFieldError":
    case "ProfanityError":
    case "GuestbookValidationError":
    case "OAuthSessionError":
      return HttpStatus.BadRequest;
    default:
      return HttpStatus.InternalServerError;
  }
};

/** User-facing message for a guestbook failure; field-only errors get one. */
const guestbookMessage = (
  error: GuestbookFlowError & {
    readonly message?: string;
    readonly field?: string | undefined;
  },
): string =>
  error._tag === "MissingFieldError"
    ? `Missing required field: ${error.field}`
    : (error.message ?? "Bad request");

const runGuestbook = <T>(
  env: CloudflareEnv,
  effect: Effect.Effect<T, GuestbookError, DatabaseService | TomQueueService>,
  context: LogContext,
): Promise<T> =>
  runAdapter(
    Effect.tryPromise(() => readCloudflareEnv(env)).pipe(
      Effect.flatMap((resolved) =>
        effect.pipe(
          // No-op binding wrapper for routes that never send, and enables
          // the sign route's best-effort enqueue without blocking the reply.
          Effect.provide(Layer.mergeAll(createDbLayer(resolved), makeTomQueueLayer(resolved))),
        ),
      ),
      // HttpError carries the response status; client-flow failures map to
      // their 4xx status with a user-facing message; anything else (env
      // resolution, database, unknown flow failures) stays a 500.
      Effect.mapError((error) =>
        error._tag === "HttpError"
          ? error
          : new HttpError({
              message: guestbookMessage(error),
              status: guestbookStatus(error),
              cause: error,
            }),
      ),
    ),
    (error) =>
      new AdapterError({ status: guestbookStatus(error), message: error.message ?? "Bad request" }),
    context,
  );

/**
 * Enqueue a `guestbook-sign` job after the entry exists in the DB. The sign
 * response never depends on the queue: a failed send is logged and the
 * user's signature still stands.
 */
const notifyGuestbookSign = (entry: GuestbookEntry): Effect.Effect<void, never, TomQueueService> =>
  Effect.gen(function* () {
    const queue = yield* TomQueueService;
    yield* queue
      .send({
        kind: "guestbook-sign",
        entryId: entry.id,
        fediverseUsername: entry.fediverse_username,
        displayName: entry.display_name ?? "",
        message: entry.message,
      })
      .pipe(
        Effect.catchTag("QueueError", (error) =>
          Effect.logWarning("guestbook:sign:enqueue-failed", { error: error.message }),
        ),
      );
  });

/**
 * In simulator mode (x-use-simulator + SIMULATOR_URL) entries come from the
 * fixture store instead of D1; the simulator mirrors DatabaseService's
 * { results, page, page_size, total_count } response shape.
 */
const simulatorEntries = (
  request: Request,
): Effect.Effect<readonly GuestbookEntry[], HttpError, never> | undefined => {
  const env = getRequestEnv(request);
  const simulatorUrl = env.SIMULATOR_URL;
  if (!isSimulatorRequest(request) || !simulatorUrl) return undefined;
  return Effect.gen(function* () {
    yield* Effect.logInfo("guestbook:entries:simulator");
    const response = yield* Effect.tryPromise({
      try: () => fetch(`${simulatorUrl}/guestbook/entries`),
      catch: (cause) =>
        new HttpError({
          message: "Guestbook simulator unavailable",
          status: 502,
          cause,
        }),
    });
    if (!response.ok) {
      return yield* new HttpError({
        message: "Guestbook simulator error",
        status: HttpStatus.BadGateway,
      });
    }
    const body = yield* Effect.tryPromise({
      try: () => response.json() as Promise<{ results: readonly GuestbookEntry[] }>,
      catch: () =>
        new HttpError({
          message: "Guestbook simulator parse error",
          status: HttpStatus.BadGateway,
        }),
    });
    yield* Effect.logInfo("guestbook:entries:simulator:success");
    return body.results;
  });
};

const dbEntries = (): Effect.Effect<readonly GuestbookEntry[], GuestbookError, DatabaseService> =>
  Effect.gen(function* () {
    yield* Effect.logInfo("guestbook:entries:start");
    const db = yield* DatabaseService;
    const data = yield* db.getGuestbookEntries({ page: 1, page_size: 100 });
    yield* Effect.logInfo("guestbook:entries:success");
    return data.results;
  });

export const userCookieSchema = Schema.fromJsonString(auth.fediverseUserSchema);
export const guestbookIntegration = new Elysia({ name: "guestbook" })
  .get(
    "/guestbook/entries",
    ({ request }) => {
      const env = getRequestEnv(request);
      const context = logContextFromRequest(request, "tom-adapter");
      // The simulator path fetches the fixture store directly and needs no DB
      // layer; runGuestbook always provisions DatabaseService, which is
      // unconfigured here (no D1), so route around it.
      if (isSimulatorRequest(request) && env.SIMULATOR_URL) {
        const effect = simulatorEntries(request);
        if (effect) {
          return runAdapter(
            effect,
            (error) =>
              new AdapterError({
                status: guestbookStatus(error),
                message: error.message ?? "Bad request",
              }),
            context,
          );
        }
      }
      return runGuestbook(env, dbEntries(), context);
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
      const user = Option.getOrElse(
        Schema.decodeUnknownOption(userCookieSchema)(userJson),
        // Signed out: return JSON null. A bare null makes Elysia send an empty
        // body, which Eden treaty parses as {} — a truthy "ghost" user that
        // flips the guestbook to the signed-in UI. The response schema keeps
        // the typed contract as FediverseUser | null for the web client.
        () => null,
      );
      return Response.json(user);
    },
    {
      cookie: guestbookUserCookieSchema,
      response: { 200: Schema.toStandardSchemaV1(Schema.NullOr(auth.fediverseUserSchema)) },
      detail: {
        description: "Get the signed-in guestbook user from the session cookie",
        tags: ["guestbook"],
      },
    },
  )
  .post(
    "/guestbook/auth/initiate",
    ({ body, cookie, request }) => {
      const env = getRequestEnv(request);
      if (!body.handle) {
        return toProblemResponse(HttpStatus.BadRequest, "Missing field: handle", {
          type: ProblemType.Validation,
          instance: request.url,
        });
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
        400: problemDetailsSchema,
        401: problemDetailsSchema,
        500: problemDetailsSchema,
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
          cookie.guestbook_user.value = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown))(
            user,
          );
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
    ({ body, cookie, request }) => {
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
        return toProblemResponse(HttpStatus.Unauthorized, "Not authenticated", {
          type: ProblemType.Unauthorized,
          instance: request.url,
        });
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

          const entry = yield* auth.signGuestbook({ user, message: body.message });
          yield* notifyGuestbookSign(entry);
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
        400: problemDetailsSchema,
        401: problemDetailsSchema,
        500: problemDetailsSchema,
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

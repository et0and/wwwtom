import type { Crypto } from "effect/Crypto";
import { Effect, Layer, Match, Option, Schema } from "effect";
import { DatabaseService, type GuestbookEntry } from "@tom/db/service";
import { makeTomQueueLayer, TomQueueService } from "@tom/utils/queue";
import { HttpStatus } from "@tom/constants/http";
import { readCloudflareEnv, type CloudflareEnv } from "@tom/utils/config";
import type { LogContext } from "@tom/utils/logging";
import {
  DatabaseConnectionError,
  MissingFieldError,
  ProfanityError,
  type AuthenticationError,
  type GuestbookValidationError,
  type OAuthSessionError,
  HttpError,
} from "@tom/types/errors";
import * as auth from "./auth";
import { AdapterError, createDbLayer, cryptoLayer, runAdapter } from "../runtime";
import { isSimulatorRequest } from "../simulator";
import { GuestbookEntrySchema } from "../schemas";

export type GuestbookError =
  | MissingFieldError
  | ProfanityError
  | AuthenticationError
  | GuestbookValidationError
  | OAuthSessionError
  | HttpError
  // The DB layer can fail to connect. That is a 500 and it belongs in the
  // union: leaving it out only worked because the old status table had a
  // catch-all fallback for unrecognised tags.
  | DatabaseConnectionError;

/**
 * HTTP status and user-facing message for a guestbook failure. `HttpError`
 * carries its own status; the client-flow failures map to 4xx. Both are
 * `Schema.TaggedError`s, so `Match.typeTags` dispatches on the tag and the
 * compiler rejects a member that is not handled — no status table to keep in
 * sync and no `"status" in error` probes.
 */
export const guestbookStatus = Match.typeTags<GuestbookError, number>()({
  HttpError: (error) => error.status,
  AuthenticationError: () => HttpStatus.Unauthorized,
  MissingFieldError: () => HttpStatus.BadRequest,
  ProfanityError: () => HttpStatus.BadRequest,
  GuestbookValidationError: () => HttpStatus.BadRequest,
  OAuthSessionError: () => HttpStatus.BadRequest,
  DatabaseConnectionError: () => HttpStatus.InternalServerError,
});

/**
 * User-facing message for a guestbook failure. `MissingFieldError` is the one
 * variant without a `message`, so it names its field; every other variant
 * surfaces its own. The union is discriminated, so no `"message" in error`
 * runtime check is needed.
 */
export const guestbookMessage = Match.typeTags<GuestbookError, string>()({
  MissingFieldError: (error) => `Missing required field: ${error.field}`,
  HttpError: (error) => error.message,
  AuthenticationError: (error) => error.message,
  ProfanityError: (error) => error.message,
  GuestbookValidationError: (error) => error.message,
  OAuthSessionError: (error) => error.message,
  DatabaseConnectionError: (error) => error.message,
});

/** Env resolution fails as an HttpError, so the error channel stays one union. */
const resolveGuestbookEnv = (env: CloudflareEnv): Effect.Effect<CloudflareEnv, HttpError> =>
  Effect.tryPromise({
    try: () => readCloudflareEnv(env),
    catch: (cause) =>
      new HttpError({
        message: "Guestbook configuration unavailable",
        status: HttpStatus.InternalServerError,
        cause,
      }),
  });

export const runGuestbook = <T>(
  env: CloudflareEnv,
  effect: Effect.Effect<T, GuestbookError, DatabaseService | TomQueueService | Crypto>,
  context: LogContext,
): Promise<T> =>
  runAdapter(
    resolveGuestbookEnv(env).pipe(
      Effect.flatMap((resolved) =>
        effect.pipe(
          // No-op binding wrapper for routes that never send, and enables
          // the sign route's best-effort enqueue without blocking the reply.
          Effect.provide(
            Layer.mergeAll(createDbLayer(resolved), makeTomQueueLayer(resolved), cryptoLayer),
          ),
        ),
      ),
      // HttpError carries the response status; client-flow failures map to
      // their 4xx status with a user-facing message.
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
    (error) => new AdapterError({ status: guestbookStatus(error), message: error.message }),
    context,
  );

/**
 * Enqueue a `guestbook-sign` job after the entry exists in the DB. The sign
 * response never depends on the queue: a failed send is logged and the
 * user's signature still stands.
 */
export const notifyGuestbookSign = (
  entry: GuestbookEntry,
): Effect.Effect<void, never, TomQueueService> =>
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
 * The simulator mirrors DatabaseService's paged response envelope, so the
 * payload is a paged object wrapping the entries — not a bare array.
 */
const SimulatorEntriesSchema = Schema.Struct({
  results: Schema.Array(GuestbookEntrySchema),
});

/**
 * In simulator mode (x-use-simulator + SIMULATOR_URL) entries come from the
 * fixture store instead of D1; the simulator mirrors DatabaseService's
 * { results, page, page_size, total_count } response shape.
 */
export const simulatorEntries = (
  simulatorUrl: string,
): Effect.Effect<ReadonlyArray<typeof GuestbookEntrySchema.Type>, HttpError, never> => {
  return Effect.gen(function* () {
    yield* Effect.logInfo("guestbook:entries:simulator");
    const response = yield* Effect.tryPromise({
      try: () => fetch(`${simulatorUrl}/guestbook/entries`),
      catch: (cause) =>
        new HttpError({
          message: "Guestbook simulator unavailable",
          status: HttpStatus.BadGateway,
          cause,
        }),
    });
    if (!response.ok) {
      return yield* new HttpError({
        message: "Guestbook simulator error",
        status: HttpStatus.BadGateway,
      });
    }
    const payload: unknown = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () =>
        new HttpError({
          message: "Guestbook simulator parse error",
          status: HttpStatus.BadGateway,
        }),
    });
    const body = yield* Schema.decodeUnknownEffect(SimulatorEntriesSchema)(payload).pipe(
      Effect.mapError(
        (cause) =>
          new HttpError({
            message: "Guestbook simulator parse error",
            status: HttpStatus.BadGateway,
            cause,
          }),
      ),
    );
    yield* Effect.logInfo("guestbook:entries:simulator:success");
    return body.results;
  });
};

const toWireEntry = (entry: GuestbookEntry): typeof GuestbookEntrySchema.Type => ({
  id: entry.id,
  fediverse_username: entry.fediverse_username,
  fediverse_instance: entry.fediverse_instance,
  display_name: entry.display_name,
  avatar_url: entry.avatar_url,
  message: entry.message,
  created_at: entry.created_at.toISOString(),
  updated_at: entry.updated_at.toISOString(),
});

export const dbEntries: Effect.Effect<
  ReadonlyArray<typeof GuestbookEntrySchema.Type>,
  GuestbookError,
  DatabaseService
> = Effect.gen(function* () {
  yield* Effect.logInfo("guestbook:entries:start");
  const db = yield* DatabaseService;
  const data = yield* db.getGuestbookEntries({ page: 1, page_size: 100 });
  yield* Effect.logInfo("guestbook:entries:success");
  return data.results.map(toWireEntry);
});

const userCookieSchema = Schema.fromJsonString(auth.fediverseUserSchema);

/**
 * Decode the guestbook_user cookie: Elysia hands back the parsed object when
 * possible, otherwise the encoded string. Null when absent or invalid.
 */
export const guestbookUserFromCookie = (
  value: Schema.Json | undefined,
): auth.FediverseUser | null => {
  if (value === undefined) return null;
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- cookie arrives as string or parsed object
  const json = typeof value === "string" ? value : JSON.stringify(value);
  return Option.getOrElse(Schema.decodeOption(userCookieSchema)(json), () => null);
};

export { isSimulatorRequest, userCookieSchema };

import { Effect, Layer, Option, Schema } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import { HttpStatus } from "@tom/constants/http";
import { problemDetailsSchema } from "@tom/schemas/error";
import { HttpError } from "@tom/types/errors";

export type EdenResult<T> = {
  data: T | null;
  error: { status: unknown; value: unknown } | null;
};

export type AdapterRequestMessages = {
  readonly failed: string;
  readonly timedOut: string;
};

/** Upper bound for a single adapter round-trip; guards against a hung worker. */
const ADAPTER_TIMEOUT_MS = 5_000;

/** The adapter's error responses are RFC 9457 problem details; parse at the boundary. */
export const adapterErrorMessage = (
  error: NonNullable<EdenResult<unknown>["error"]>,
  fallbackMessage: string,
): string =>
  Option.getOrElse(
    Option.map(
      Schema.decodeUnknownOption(problemDetailsSchema)(error.value),
      (body) => body.detail ?? body.title,
    ),
    () => fallbackMessage,
  );

/**
 * Adapter request as an Effect: network failures and non-2xx responses
 * surface as tagged HttpErrors in the error channel instead of thrown
 * exceptions.
 */
export const adapterRequest = <T>(
  request: () => Promise<EdenResult<T>>,
  messages: AdapterRequestMessages,
): Effect.Effect<T, HttpError> =>
  Effect.tryPromise(() => request()).pipe(
    Effect.mapError(
      () =>
        new HttpError({
          message: messages.failed,
          status: HttpStatus.InternalServerError,
        }),
    ),
    Effect.flatMap((result) =>
      result.error
        ? Effect.fail(
            new HttpError({
              message: adapterErrorMessage(result.error, messages.failed),
              status: Number(result.error.status) || 500,
            }),
          )
        : Effect.succeed(result.data as T),
    ),
    Effect.timeoutOrElse({
      duration: ADAPTER_TIMEOUT_MS,
      orElse: () =>
        Effect.fail(
          new HttpError({
            message: messages.timedOut,
            status: HttpStatus.GatewayTimeout,
          }),
        ),
    }),
  );

/**
 * HttpClient bound to the current global fetch. Built per call because the
 * Fetch reference default pins the first-seen implementation process-wide.
 */
// @effect-diagnostics-next-line lazyEffect:off
export const liveHttpClient = (): Layer.Layer<HttpClient.HttpClient> =>
  Layer.provideMerge(FetchHttpClient.layer, Layer.succeed(FetchHttpClient.Fetch, globalThis.fetch));

export const workerCache = (): Cache | null =>
  (globalThis as { caches?: { default?: Cache } }).caches?.default ?? null;

/** Run a client effect as a promise at the Solid boundary. */
export const runClient = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
  Effect.runPromise(effect);

/**
 * Run a client read, mapping a 404 to null (absent resource). Other
 * failures still reject, so detail pages render a not-found state from
 * settled null data instead of an error banner.
 */
export const runClientOrNull = <T>(effect: Effect.Effect<T, HttpError>): Promise<T | null> =>
  Effect.runPromise(
    effect.pipe(
      Effect.catchTag("HttpError", (error) =>
        error.status === HttpStatus.NotFound ? Effect.succeed(null) : Effect.fail(error),
      ),
    ),
  );

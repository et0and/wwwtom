import { treaty } from "@elysiajs/eden";
import { isServer } from "@solidjs/web";
import { Effect, Option, Schema } from "effect";
import type { AdapterApp } from "@tom/adapter";
import { HttpStatus } from "@tom/constants/http";
import { HttpError } from "@tom/types/errors";

const DEV_ADAPTER_URL = "http://localhost:8790";
const PROD_ADAPTER_URL = "https://adapter.sophie.st";

/**
 * Sophie adapter base URL. On the server the per-stage URL comes from the
 * worker env; the client uses the build-time inline or stage defaults.
 */
export const getAdapterBaseUrl = (): string => {
  const buildUrl = import.meta.env.VITE_ADAPTER_URL as string | undefined;
  if (isServer) return process.env.ADAPTER_URL ?? buildUrl ?? DEV_ADAPTER_URL;
  if (buildUrl) return buildUrl;
  return import.meta.env.PROD ? PROD_ADAPTER_URL : DEV_ADAPTER_URL;
};

/**
 * Typed treaty client to the Sophie adapter (the same Elysia app Tom uses,
 * pointed at Sophie URLs). All backend reads flow through callSophie, so
 * routes stay typed end to end with no hand-written fetch wrapper.
 */
export const callSophie = () => treaty<AdapterApp>(getAdapterBaseUrl());

type EdenResult<T> = {
  data: T | null;
  error: { status: unknown; value: unknown } | null;
};

/** The adapter's error responses are RFC 9457 problem details; parse at the boundary. */
const ProblemDetailsBody = Schema.Struct({
  type: Schema.String,
  status: Schema.Number,
  title: Schema.String,
  detail: Schema.optional(Schema.String),
});

const errorMessage = (error: NonNullable<EdenResult<unknown>["error"]>): string =>
  Option.getOrElse(
    Option.map(
      Schema.decodeUnknownOption(ProblemDetailsBody)(error.value),
      (body) => body.detail ?? body.title,
    ),
    () => "Sophie request failed",
  );

/** Upper bound for a single adapter round-trip; guards against a hung worker. */
const ADAPTER_TIMEOUT_MS = 5_000;

/**
 * Adapter request as an Effect: network failures and non-2xx responses
 * surface as tagged HttpErrors in the error channel instead of thrown
 * exceptions.
 */
export const adapterRequest = <T>(
  request: () => Promise<EdenResult<T>>,
): Effect.Effect<T, HttpError> =>
  Effect.tryPromise(() => request()).pipe(
    Effect.mapError(
      () =>
        new HttpError({
          message: "Sophie request failed",
          status: HttpStatus.InternalServerError,
        }),
    ),
    Effect.flatMap((result) =>
      result.error
        ? Effect.fail(
            new HttpError({
              message: errorMessage(result.error),
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
            message: "Sophie request timed out",
            status: HttpStatus.GatewayTimeout,
          }),
        ),
    }),
  );

/** Run a client effect as a promise at the Solid boundary. */
export const runClient = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
  Effect.runPromise(effect);

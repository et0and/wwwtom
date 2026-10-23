import { Effect, Schema } from "effect";
import { CmsError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";

/** Adapter origin, inlined at build time for production. */
export const adapterUrl = (): string =>
  import.meta.env.VITE_ADAPTER_URL ?? LOCAL_SERVICE_URLS.adapter;

/** Session requests never hang: abort slow fetches so the shell always settles. */
const REQUEST_TIMEOUT_MS = 15000;

const fetchWithTimeout = (url: string, init: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};

/** JSON GET/POST against the adapter with session cookies. */
export const requestJson = (
  path: string,
  init: RequestInit,
  operation: string,
): Effect.Effect<unknown, CmsError> =>
  Effect.tryPromise({
    try: () => fetchWithTimeout(`${adapterUrl()}${path}`, { ...init, credentials: "include" }),
    catch: (cause) =>
      new CmsError({
        message: "Editor request failed",
        status: HttpStatus.InternalServerError,
        operation,
        cause,
      }),
  }).pipe(
    Effect.flatMap((response) =>
      response.ok
        ? Effect.tryPromise({
            try: () => response.json() as Promise<unknown>,
            catch: (cause) =>
              new CmsError({
                message: "Invalid editor response",
                status: HttpStatus.InternalServerError,
                operation,
                cause,
              }),
          })
        : Effect.fail(
            new CmsError({
              message: `Editor request failed: ${response.status}`,
              status: response.status,
              operation,
            }),
          ),
    ),
  );

/** Void POST against the adapter with session cookies (sign-out). */
export const requestVoid = (
  path: string,
  init: RequestInit,
  operation: string,
): Effect.Effect<void, CmsError> =>
  Effect.tryPromise({
    try: () => fetchWithTimeout(`${adapterUrl()}${path}`, { ...init, credentials: "include" }),
    catch: (cause) =>
      new CmsError({
        message: "Editor request failed",
        status: HttpStatus.InternalServerError,
        operation,
        cause,
      }),
  }).pipe(
    Effect.flatMap((response) =>
      response.ok
        ? Effect.void
        : Effect.fail(
            new CmsError({
              message: `Editor request failed: ${response.status}`,
              status: response.status,
              operation,
            }),
          ),
    ),
    Effect.asVoid,
  );

/** Decode unknown JSON into a domain type at the client boundary. */
export const decodeResponse = <A, I, J>(
  schema: Schema.Codec<A, I>,
  json: J,
  operation: string,
  message = "Invalid editor response",
): Effect.Effect<A, CmsError> =>
  Schema.decodeUnknownEffect(schema)(json).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({ message, status: HttpStatus.InternalServerError, operation, cause }),
    ),
  );

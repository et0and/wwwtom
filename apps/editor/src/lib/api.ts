import { Effect, Schema } from "effect";
import { CmsError } from "@tom/types/errors";

/** Adapter origin, inlined at build time for production. */
export const adapterUrl = (): string => import.meta.env.VITE_ADAPTER_URL ?? "http://localhost:8788";

/** Run a client effect as a promise at the Solid boundary. */
export const runClient = <A, E>(effect: Effect.Effect<A, E>): Promise<A> =>
  Effect.runPromise(effect);

/** JSON GET/POST against the adapter with session cookies. */
export const requestJson = (
  path: string,
  init: RequestInit,
  operation: string,
): Effect.Effect<unknown, CmsError> =>
  Effect.tryPromise({
    try: () => fetch(`${adapterUrl()}${path}`, { ...init, credentials: "include" }),
    catch: (cause) =>
      new CmsError({ message: "Editor request failed", status: 500, operation, cause }),
  }).pipe(
    Effect.flatMap((response) =>
      response.ok
        ? Effect.tryPromise({
            try: () => response.json() as Promise<unknown>,
            catch: (cause) =>
              new CmsError({
                message: "Invalid editor response",
                status: 500,
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
    try: () => fetch(`${adapterUrl()}${path}`, { ...init, credentials: "include" }),
    catch: (cause) =>
      new CmsError({ message: "Editor request failed", status: 500, operation, cause }),
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
    Effect.mapError((cause) => new CmsError({ message, status: 500, operation, cause })),
  );

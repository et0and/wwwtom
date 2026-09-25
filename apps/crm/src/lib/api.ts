import { Effect, Schema } from "effect";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import { CmsError } from "@tom/types/errors";

const REQUEST_TIMEOUT_MS = 15000;

export const adapterUrl = (): string =>
  import.meta.env.VITE_ADAPTER_URL ?? LOCAL_SERVICE_URLS.adapter;

const fetchWithTimeout = (url: string, init: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, { ...init, credentials: "include", signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
};

const responseError = (response: Response, operation: string): CmsError =>
  new CmsError({
    message: `CRM request failed: ${response.status}`,
    status: response.status,
    operation,
  });

export const requestJson = <A, I>(
  path: string,
  init: RequestInit,
  schema: Schema.Codec<A, I>,
  operation: string,
): Effect.Effect<A, CmsError> =>
  Effect.tryPromise({
    try: () => fetchWithTimeout(`${adapterUrl()}${path}`, init),
    catch: (cause) =>
      new CmsError({ message: "CRM request failed", status: 500, operation, cause }),
  }).pipe(
    Effect.flatMap((response) =>
      response.ok
        ? Effect.tryPromise({
            try: () => response.json() as Promise<unknown>,
            catch: (cause) =>
              new CmsError({
                message: "Invalid CRM response",
                status: 500,
                operation,
                cause,
              }),
          }).pipe(
            Effect.flatMap((value) =>
              Schema.decodeUnknownEffect(schema)(value).pipe(
                Effect.mapError(
                  (cause) =>
                    new CmsError({
                      message: "Invalid CRM response",
                      status: 500,
                      operation,
                      cause,
                    }),
                ),
              ),
            ),
          )
        : Effect.fail(responseError(response, operation)),
    ),
  );

export const requestVoid = (
  path: string,
  init: RequestInit,
  operation: string,
): Effect.Effect<void, CmsError> =>
  Effect.tryPromise({
    try: () => fetchWithTimeout(`${adapterUrl()}${path}`, init),
    catch: (cause) =>
      new CmsError({ message: "CRM request failed", status: 500, operation, cause }),
  }).pipe(
    Effect.flatMap((response) =>
      response.ok ? Effect.void : Effect.fail(responseError(response, operation)),
    ),
  );

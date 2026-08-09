import { treaty } from "@elysiajs/eden";
import type { AdapterApp } from "@tom/adapter";
import { getRequestEvent } from "solid-js/web";
import { Effect } from "effect";
import { HttpError } from "@tom/types/errors";

const DEV_ADAPTER_URL = "http://localhost:8788";
const PROD_ADAPTER_URL = "https://adapter.tom.so";

type RequestContext = {
  cloudflare?: { env?: { ADAPTER_URL?: string } };
};

/**
 * The adapter's base URL. On the server it comes from the Worker binding
 * (per-stage); the client uses the build-time VITE_ADAPTER_URL that Alchemy
 * inlines for production, falling back to localhost in dev.
 */
export const getAdapterBaseUrl = (): string => {
  if (import.meta.env.SSR) {
    const event = getRequestEvent();
    const context = event?.nativeEvent.context as RequestContext | undefined;
    const bindingUrl = context?.cloudflare?.env?.ADAPTER_URL;
    if (bindingUrl) return bindingUrl;
    const buildUrl = import.meta.env.VITE_ADAPTER_URL as string | undefined;
    if (buildUrl) return buildUrl;
    return process.env.ADAPTER_URL ?? DEV_ADAPTER_URL;
  }
  const buildUrl = import.meta.env.VITE_ADAPTER_URL as string | undefined;
  if (buildUrl) return buildUrl;
  return import.meta.env.PROD ? PROD_ADAPTER_URL : DEV_ADAPTER_URL;
};

/**
 * Typed client to the Tom adapter (the BFF). All backend data flows through
 * callAdapter — the web app has no direct service integrations of its own.
 * Credentials are included so the guestbook cookies set by the adapter are
 * sent on browser calls.
 */
export const callAdapter = () =>
  treaty<AdapterApp>(getAdapterBaseUrl(), {
    fetch: { credentials: "include" },
  });

type EdenResult<T> = {
  data: T | null;
  error: { status: unknown; value: unknown } | null;
};

export const toErrorMessage = (value: unknown): string => {
  if (value && typeof value === "object" && "error" in value) {
    const error = (value as { error: unknown }).error;
    if (typeof error === "string") return error;
  }
  return "Adapter request failed";
};

/**
 * Unwrap an Eden treaty result, throwing an HttpError with the adapter's
 * error message and status when the request failed.
 */
export const unwrapAdapter = <T>(result: EdenResult<T>): T => {
  if (result.error) {
    throw new HttpError({
      message: toErrorMessage(result.error.value),
      status: Number(result.error.status) || 500,
    });
  }
  return result.data as T;
};

/**
 * Adapter request as an Effect: network failures and non-2xx responses
 * surface as tagged HttpErrors in the error channel instead of thrown
 * exceptions.
 */
export const adapterRequest = <T>(
  request: () => Promise<EdenResult<T>>,
): Effect.Effect<T, HttpError> =>
  Effect.tryPromise(() => request()).pipe(
    Effect.mapError(() => new HttpError({ message: "Adapter request failed", status: 500 })),
    Effect.flatMap((result) =>
      result.error
        ? Effect.fail(
            new HttpError({
              message: toErrorMessage(result.error.value),
              status: Number(result.error.status) || 500,
            }),
          )
        : Effect.succeed(result.data as T),
    ),
  );

/** Run an adapter request to completion, rejecting with HttpError on failure. */
export const runAdapterRequest = <T>(request: () => Promise<EdenResult<T>>): Promise<T> =>
  Effect.runPromise(adapterRequest(request));

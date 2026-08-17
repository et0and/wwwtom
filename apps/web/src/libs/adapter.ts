import { treaty } from "@elysiajs/eden";
import type { AdapterApp } from "@tom/adapter";
import { getRequestEvent } from "solid-js/web";
import { Effect, Option, Schema } from "effect";
import { HttpError } from "@tom/types/errors";
import { withLogging } from "@tom/utils/services/logging";
import type { LogContext } from "@tom/utils/services/logging";

const DEV_ADAPTER_URL = "http://localhost:8788";
const PROD_ADAPTER_URL = "https://adapter.tom.so";

type RequestContext = {
  cloudflare?: { env?: { ADAPTER_URL?: string } };
  logContext?: LogContext;
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
 * sent on browser calls. On the server, an incoming `x-use-simulator` header
 * (set by the e2e suite) is forwarded so the adapter routes its upstreams to
 * the fixture simulator.
 */
export const callAdapter = () => {
  const headers: Record<string, string> = {};
  if (import.meta.env.SSR) {
    const simulatorHeader = getRequestEvent()?.request.headers.get("x-use-simulator");
    if (simulatorHeader) headers["x-use-simulator"] = simulatorHeader;
  }
  const fetchOptions: { credentials: "include" } & { headers?: Record<string, string> } = {
    credentials: "include",
  };
  if (Object.keys(headers).length > 0) fetchOptions.headers = headers;
  return treaty<AdapterApp>(getAdapterBaseUrl(), { fetch: fetchOptions });
};

type EdenResult<T> = {
  data: T | null;
  error: { status: unknown; value: unknown } | null;
};

/** The adapter's error responses are `{ error: string }`; parse at the boundary. */
const AdapterErrorBody = Schema.Struct({ error: Schema.String });

const errorMessage = (error: NonNullable<EdenResult<unknown>["error"]>): string =>
  Option.getOrElse(
    Option.map(Schema.decodeUnknownOption(AdapterErrorBody)(error.value), (body) => body.error),
    () => "Adapter request failed",
  );

/**
 * Unwrap an Eden treaty result, throwing an HttpError with the adapter's
 * error message and status when the request failed.
 */
export const unwrapAdapter = <T>(result: EdenResult<T>): T => {
  if (result.error) {
    throw new HttpError({
      message: errorMessage(result.error),
      status: Number(result.error.status) || 500,
    });
  }
  return result.data as T;
};

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
    Effect.mapError(() => new HttpError({ message: "Adapter request failed", status: 500 })),
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
        Effect.fail(new HttpError({ message: "Adapter request timed out", status: 504 })),
    }),
  );

/** Run an adapter request to completion, rejecting with HttpError on failure. */
export const runAdapterRequest = <T>(request: () => Promise<EdenResult<T>>): Promise<T> => {
  const context = getServerLogContext();
  return Effect.runPromise(
    withLogging(adapterRequest(request).pipe(Effect.withSpan("web.adapterRequest")), context),
  );
};

/** Logging context for the current SSR request, if any. */
const getServerLogContext = (): LogContext => {
  if (!import.meta.env.SSR) return { serviceName: "tom-web" };
  const event = getRequestEvent();
  const logContext = (event?.nativeEvent.context as RequestContext | undefined)?.logContext;
  return logContext ?? { serviceName: "tom-web" };
};

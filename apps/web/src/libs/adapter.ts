import { treaty } from "@elysiajs/eden";
import type { AdapterApp } from "@tom/adapter";
import { getRequestEvent, isServer } from "@solidjs/web";
import { Effect } from "effect";
import { HttpError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import {
  adapterErrorMessage,
  adapterRequest as sharedAdapterRequest,
} from "@tom/utils/services/http";
import type { EdenResult } from "@tom/utils/services/http";
import { withLogging } from "@tom/utils/services/logging";
import type { LogContext } from "@tom/utils/services/logging";

const DEV_ADAPTER_URL = LOCAL_SERVICE_URLS.adapter;
const PROD_ADAPTER_URL = "https://adapter.tom.so";

/**
 * The adapter's base URL. On the server the per-stage URL is either the
 * build-time VITE_ADAPTER_URL that Alchemy inlines into the SSR bundle for
 * every stage, or the dev default; the client uses the same inline. The
 * guestbook flow needs no Worker binding on the web worker itself — the
 * adapter is a public host.
 */
export const getAdapterBaseUrl = (): string => {
  const buildUrl = import.meta.env.VITE_ADAPTER_URL as string | undefined;
  if (isServer) {
    if (buildUrl) return buildUrl;
    return process.env.ADAPTER_URL ?? DEV_ADAPTER_URL;
  }
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
  if (isServer) {
    const simulatorHeader = getRequestEvent()?.request.headers.get("x-use-simulator");
    if (simulatorHeader) headers["x-use-simulator"] = simulatorHeader;
  }
  const fetchOptions: { credentials: "include" } & { headers?: Record<string, string> } = {
    credentials: "include",
  };
  if (Object.keys(headers).length > 0) fetchOptions.headers = headers;
  return treaty<AdapterApp>(getAdapterBaseUrl(), { fetch: fetchOptions });
};

const ADAPTER_REQUEST_MESSAGES = {
  failed: "Adapter request failed",
  timedOut: "Adapter request timed out",
};

export const adapterRequest = <T>(
  request: () => Promise<EdenResult<T>>,
): Effect.Effect<T, HttpError> => sharedAdapterRequest(request, ADAPTER_REQUEST_MESSAGES);

/**
 * Unwrap an Eden treaty result, throwing an HttpError with the adapter's
 * error message and status when the request failed.
 */
export const unwrapAdapter = <T>(result: EdenResult<T>): T => {
  if (result.error) {
    throw new HttpError({
      message: adapterErrorMessage(result.error, ADAPTER_REQUEST_MESSAGES.failed),
      status: Number(result.error.status) || 500,
    });
  }
  return result.data as T;
};

/** Run a logged adapter effect to completion in the current SSR context. */
const runLoggedAdapterRequest = <T, E>(
  effect: Effect.Effect<T, E>,
  operation: string,
): Promise<T> => {
  const context = getServerLogContext();
  return Effect.runPromise(withLogging(effect.pipe(Effect.withSpan(operation)), context));
};

/** Run an adapter request to completion, rejecting with HttpError on failure. */
export const runAdapterRequest = <T>(request: () => Promise<EdenResult<T>>): Promise<T> =>
  runLoggedAdapterRequest(adapterRequest(request), "web.adapterRequest");

/**
 * Run an adapter read to completion, mapping a 404 to null (absent
 * resource). Other failures still reject, so lists keep throwing while
 * detail pages render a not-found state from settled null data.
 */
export const runAdapterRequestOrNull = <T>(
  request: () => Promise<EdenResult<T>>,
): Promise<T | null> =>
  runLoggedAdapterRequest(
    adapterRequest(request).pipe(
      Effect.catchTag("HttpError", (error) =>
        error.status === HttpStatus.NotFound ? Effect.succeed(null) : Effect.fail(error),
      ),
    ),
    "web.adapterRequestOrNull",
  );

/** Logging context for the current SSR request, if any. */
const getServerLogContext = (): LogContext => {
  if (!isServer) return { serviceName: "tom-web" };
  const event = getRequestEvent();
  const logContext = event?.locals.logContext;
  return logContext ?? { serviceName: "tom-web" };
};

import { treaty } from "@elysiajs/eden";
import { getRequestEvent, isServer } from "@solidjs/web";
import { Effect } from "effect";
import type { AdapterApp } from "@tom/adapter";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import { HttpStatus } from "@tom/constants/http";
import { HttpError } from "@tom/types/errors";
import { adapterRequest as sharedAdapterRequest } from "@tom/utils/http";
import type { EdenResult } from "@tom/utils/http";
import { withLogging } from "@tom/utils/logging";
import type { LogContext } from "@tom/utils/logging";

const DEV_ADAPTER_URL = LOCAL_SERVICE_URLS.sophieAdapter;
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
 *
 * `parseDate: false`: Eden revives any ISO timestamp into a `Date`, which the
 * wire schemas declare as a string and `@tom/utils/date` then renders empty.
 */
export const callSophie = () => treaty<AdapterApp>(getAdapterBaseUrl(), { parseDate: false });

const SOPHIE_REQUEST_MESSAGES = {
  failed: "Sophie request failed",
  timedOut: "Sophie request timed out",
};

export const adapterRequest = <T>(
  request: () => Promise<EdenResult<T>>,
): Effect.Effect<T, HttpError> => sharedAdapterRequest(request, SOPHIE_REQUEST_MESSAGES);

/** Logging context for the current SSR request, if any. */
const getServerLogContext = (): LogContext => {
  if (!isServer) return { serviceName: "sophie-web" };
  const event = getRequestEvent();
  return event?.locals.logContext ?? { serviceName: "sophie-web" };
};

/**
 * Run a Sophie request as a promise in the current SSR context. The wrapped
 * effect exports a span and log records with the request's annotations, so
 * the adapter round-trips are queryable alongside web's.
 */
export const runSophieRequest = <T, E>(
  effect: Effect.Effect<T, E>,
  operation: string,
): Promise<T> =>
  Effect.runPromise(withLogging(effect.pipe(Effect.withSpan(operation)), getServerLogContext()));

/**
 * Run a Sophie read, mapping a 404 to null (absent resource). Other failures
 * still reject, so lists keep throwing while detail pages render a not-found
 * state from settled null data.
 */
export const runSophieRequestOrNull = <T>(
  effect: Effect.Effect<T, HttpError>,
  operation: string,
): Promise<T | null> =>
  runSophieRequest(
    effect.pipe(
      Effect.catchTag("HttpError", (error) =>
        error.status === HttpStatus.NotFound ? Effect.succeed(null) : Effect.fail(error),
      ),
    ),
    operation,
  );

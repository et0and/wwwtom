import { treaty } from "@elysiajs/eden";
import { isServer } from "@solidjs/web";
import { Effect } from "effect";
import type { AdapterApp } from "@tom/adapter";
import { HttpError } from "@tom/types/errors";
import { adapterRequest as sharedAdapterRequest } from "@tom/utils/services/http";
import type { EdenResult } from "@tom/utils/services/http";

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

const SOPHIE_REQUEST_MESSAGES = {
  failed: "Sophie request failed",
  timedOut: "Sophie request timed out",
};

export const adapterRequest = <T>(
  request: () => Promise<EdenResult<T>>,
): Effect.Effect<T, HttpError> => sharedAdapterRequest(request, SOPHIE_REQUEST_MESSAGES);

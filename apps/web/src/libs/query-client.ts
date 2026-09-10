import { QueryClient } from "@tanstack/solid-query";
import { getRequestEvent } from "@solidjs/web";

/** List freshness: indexes refetch after 5 minutes stale. */
const STALE_MS = 1000 * 60 * 5;
/** Shared-client retention: entries survive 30 minutes after unmount. */
const GC_MS = 1000 * 60 * 30;

const DEFAULT_OPTIONS = {
  queries: {
    staleTime: STALE_MS,
    gcTime: GC_MS,
    // Detail reads map 404s to settled null data (see
    // runAdapterRequestOrNull), so absent slugs never enter the error
    // channel; other failures retry once.
    retry: 1,
    refetchOnWindowFocus: false,
  },
};

/**
 * Fallback client: unit tests and code outside a request scope (client
 * mutations, navigations). The SSR path creates one fresh client per
 * request (locals.queryClient) so parallel renders never share state.
 */
export const queryClient = new QueryClient({ defaultOptions: DEFAULT_OPTIONS });

export const createRequestQueryClient = (): QueryClient =>
  new QueryClient({ defaultOptions: DEFAULT_OPTIONS });

/** The client for the current scope: the per-request client on the server, the shared client everywhere else. */
export const getQueryClient = (): QueryClient =>
  getRequestEvent()?.locals.queryClient ?? queryClient;

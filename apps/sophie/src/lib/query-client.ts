import { QueryClient } from "@tanstack/solid-query";
import { getRequestEvent } from "@solidjs/web";

const DEFAULT_OPTIONS = {
  queries: {
    staleTime: 1000 * 60 * 5,
    retry: 1,
    refetchOnWindowFocus: false,
  },
} as const;

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

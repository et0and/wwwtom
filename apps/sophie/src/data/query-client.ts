import { QueryClient } from "@tanstack/solid-query";
import { getRequestEvent, isServer } from "@solidjs/web";
import { RequestScopeMissingError } from "@tom/types/errors";

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

/**
 * The client for the current scope: the per-request client on the server,
 * the shared client everywhere else. A server call without a request client
 * is a bug — falling back would share one cache across requests — so fail
 * loud instead of leaking.
 */
export const getQueryClient = (): QueryClient => {
  const client = getRequestEvent()?.locals.queryClient as QueryClient | undefined;
  if (client) return client;
  if (isServer) {
    throw new RequestScopeMissingError({
      message: "getQueryClient() ran outside a request scope on the server",
    });
  }
  return queryClient;
};

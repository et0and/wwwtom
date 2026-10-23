import { treaty } from "@elysiajs/eden";
import type { ApiApp } from "@tom/api";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";

/**
 * Typed client to the Tom domain API (apps/api).
 * Integrations call callApi instead of talking to apps/api services directly.
 * When a token is provided, every request carries the shared internal token
 * header so the API's protected routes accept it.
 *
 * `parseDate: false` on every treaty client in this repo: Eden revives any
 * ISO timestamp into a `Date`, which the wire schemas declare as a string and
 * the Effect codecs then reject. See `apps/web/src/libs/adapter.ts`.
 */
export const callApi = (apiUrl: string, token?: string) => {
  // `redirect: "manual"` passes upstream redirects through as responses
  // instead of following them, so the adapter can forward the Location
  // header to the browser.
  const fetchOptions: { redirect: "manual" } & { headers?: Record<string, string> } = {
    redirect: "manual",
  };
  if (token) fetchOptions.headers = { [INTERNAL_TOKEN_HEADER]: token };
  return treaty<ApiApp>(apiUrl, { fetch: fetchOptions, parseDate: false });
};

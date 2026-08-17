import { treaty } from "@elysiajs/eden";
import type { ApiApp } from "@tom/api";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";

/**
 * Typed client to the Tom domain API (apps/api).
 * Integrations call callApi instead of talking to apps/api services directly.
 * When a token is provided, every request carries the shared internal token
 * header so the API's protected routes accept it.
 */
export const callApi = (apiUrl: string, token?: string) => {
  // Pass through upstream redirects (e.g. the API's /checkout 302 to Polar) as
  // responses instead of following them, so the adapter can forward the
  // Location header to the browser.
  const fetchOptions = { redirect: "manual" as const };
  return token
    ? treaty<ApiApp>(apiUrl, { fetch: fetchOptions, headers: { [INTERNAL_TOKEN_HEADER]: token } })
    : treaty<ApiApp>(apiUrl, { fetch: fetchOptions });
};

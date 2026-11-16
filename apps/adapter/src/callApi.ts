import { treaty } from "@elysiajs/eden";
import type { ApiApp } from "@tom/api";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";

export type ApiClientOptions = {
  /** Shared internal token for routes the adapter alone may call. */
  readonly token?: string | undefined;
  /** Binding-backed fetch; falls back to the global fetch when absent. */
  readonly fetcher?: typeof globalThis.fetch | undefined;
  /** Extra request headers, e.g. the browser cookie a read must honour. */
  readonly headers?: Record<string, string> | undefined;
};

/**
 * Typed client to the Tom domain API (apps/api).
 * Integrations call callApi instead of talking to apps/api services directly.
 * When a token is provided, every request carries the shared internal token
 * header so the API's protected routes accept it. When a service binding is
 * provided, requests skip the public hostname entirely.
 *
 * `parseDate: false` on every treaty client in this repo: Eden revives any
 * ISO timestamp into a `Date`, which the wire schemas declare as a string and
 * the Effect codecs then reject. See `apps/web/src/libs/adapter.ts`.
 */
export const callApi = (apiUrl: string, options: ApiClientOptions = {}) => {
  // `redirect: "manual"` passes upstream redirects through as responses
  // instead of following them, so the adapter can forward the Location
  // header to the browser.
  // Headers go on the treaty config, not on `fetch`: Eden spreads the
  // RequestInit after the config headers, so a token there would be dropped.
  const tokenHeaders = (token: string | undefined): Record<string, string> =>
    token === undefined ? {} : { [INTERNAL_TOKEN_HEADER]: token };
  const headers = { ...tokenHeaders(options.token), ...options.headers };
  return treaty<ApiApp>(apiUrl, {
    fetch: { redirect: "manual" },
    ...(Object.keys(headers).length > 0 && { headers }),
    parseDate: false,
    ...(options.fetcher && { fetcher: options.fetcher }),
  });
};

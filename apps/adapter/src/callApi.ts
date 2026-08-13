import { treaty } from "@elysiajs/eden";
import type { ApiApp } from "@tom/api";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";

/**
 * Typed client to the Tom domain API (apps/api).
 * Integrations call callApi instead of talking to apps/api services directly.
 * When a token is provided, every request carries the shared internal token
 * header so the API's protected routes accept it.
 */
export const callApi = (apiUrl: string, token?: string) =>
  treaty<ApiApp>(apiUrl, token ? { headers: { [INTERNAL_TOKEN_HEADER]: token } } : {});

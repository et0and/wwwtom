import { treaty } from "@elysiajs/eden";
import type { ApiApp } from "@tom/api";

/**
 * Typed client to the Tom domain API (apps/api).
 * Integrations call callApi instead of talking to apps/api services directly.
 */
export const callApi = (apiUrl: string) => treaty<ApiApp>(apiUrl);

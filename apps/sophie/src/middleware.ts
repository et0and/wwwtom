import { getRequestEvent } from "@solidjs/web";
import { createRequestQueryClient } from "./lib/query-client";

/**
 * Per-request server middleware (start mode). Runs inside the request-event
 * scope for every dispatched request so getRequestEvent() answers everywhere.
 */
export default async function middleware(request: Request, next: () => Promise<Response>) {
  const event = getRequestEvent();
  if (event) {
    // One fresh query cache per request so parallel SSR renders never share
    // cache state (Solid 2 request scopes are async-local).
    event.locals.queryClient = createRequestQueryClient();
  }
  return next();
}

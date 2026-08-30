import { getRequestEvent } from "@solidjs/web";
import type { CloudflareEnv } from "@tom/utils/services/config";
import { logLevelFromEnv, otelConfigFromEnv } from "@tom/utils/services/logging";
import type { LogContext } from "@tom/utils/services/logging";
import { createRequestQueryClient } from "~/libs/query-client";
import { handleFeed, handleRobots, handleSitemap } from "~/server/static-routes";

/**
 * Per-request server middleware (start mode). Runs inside the request-event
 * scope for every dispatched request — pages and the non-HTML endpoints
 * below — so getRequestEvent() answers everywhere.
 */
export default async function middleware(request: Request, next: () => Promise<Response>) {
  const event = getRequestEvent();
  const env = process.env as CloudflareEnv;
  const otel = await otelConfigFromEnv(env).catch(() => undefined);

  const logContext: LogContext = {
    serviceName: "tom-web",
    requestId: crypto.randomUUID(),
    logLevel: logLevelFromEnv(env),
    ...(otel && { otel }),
  };
  if (event) {
    event.locals.logContext = logContext;
    // One fresh query cache per request so parallel SSR renders never share
    // cache state (Solid 2 request scopes are async-local).
    event.locals.queryClient = createRequestQueryClient();
  }

  const pathname = new URL(request.url).pathname;
  if (pathname === "/feed.xml") return handleFeed();
  if (pathname === "/sitemap.xml") return handleSitemap();
  if (pathname === "/robots.txt") return handleRobots();

  return next();
}

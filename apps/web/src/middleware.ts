import { getRequestEvent } from "@solidjs/web";
import { Effect } from "effect";
import { InvalidUrlError } from "@tom/types/errors";
import type { CloudflareEnv } from "@tom/utils/services/config";
import { logLevelFromEnv, otelConfigFromEnv } from "@tom/utils/services/logging";
import type { LogContext } from "@tom/utils/services/logging";
import { createRequestQueryClient } from "~/libs/query-client";
import { handleFeed, handleRobots, handleSitemap } from "~/server/static-routes";
import { handleFlags } from "~/server/flags";

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

  const url = Effect.runSync(
    Effect.try({
      // Effect.try is the Effect-idiomatic try/catch; request.url is
      // platform-valid (mirrors infra/runner).
      // pi-lens-ignore: unchecked-throwing-call
      try: () => new URL(request.url),
      catch: (cause) => new InvalidUrlError({ message: "Invalid request URL", cause }),
    }),
  );
  const pathname = url.pathname;
  if (pathname === "/feed.xml") return handleFeed();
  if (pathname === "/sitemap.xml") return handleSitemap();
  if (pathname === "/robots.txt") return handleRobots();
  // Same-origin flag refetch for the client (used-only list; see server/flags.ts).
  if (pathname === "/api/flags") return handleFlags(url, logContext);

  return next();
}

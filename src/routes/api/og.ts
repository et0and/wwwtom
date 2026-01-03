import type { APIEvent } from "@solidjs/start/server";
import { getRequestEvent } from "solid-js/web";
import { Effect } from "effect";
import { logger } from "~/libs/utils/logger";

export function GET({ request }: APIEvent) {
  const url = new URL(request.url);
  const title = url.searchParams.get("title");
  const summary = url.searchParams.get("summary");

  const event = getRequestEvent();
  const env = event?.nativeEvent.context.cloudflare?.env as { OG_SERVICE_URL?: string } | undefined;

  const program = Effect.gen(function* () {
    const upstreamUrl = env?.OG_SERVICE_URL;
    if (!upstreamUrl) {
      return yield* Effect.fail(new Response("OG service not configured", { status: 500 }));
    }

    const params = new URLSearchParams();
    if (title) params.set("title", title);
    if (summary) params.set("summary", summary);

    const targetUrl = `${upstreamUrl}/og/?${params.toString()}`;

    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(targetUrl, {
          cf: {
            cacheTtl: 31536000,
            cacheEverything: true,
          },
        } as RequestInit),
      catch: (error) => {
        logger.error("OG image proxy error:", error);
        return new Response("Failed to fetch OG image", { status: 500 });
      },
    });

    if (!response.ok) {
      return yield* Effect.fail(new Response("Failed to generate OG image", { status: 500 }));
    }

    const imageBuffer = yield* Effect.tryPromise({
      try: () => response.arrayBuffer(),
      catch: (error) => {
        logger.error("Failed to read image buffer:", error);
        return new Response("Failed to read image data", { status: 500 });
      },
    });

    return new Response(imageBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
        "CDN-Cache-Control": "public, max-age=31536000",
        "Cloudflare-CDN-Cache-Control": "public, max-age=31536000",
      },
    });
  });

  return Effect.runPromise(
    program.pipe(Effect.catchAll((errorResponse) => Effect.succeed(errorResponse))),
  );
}

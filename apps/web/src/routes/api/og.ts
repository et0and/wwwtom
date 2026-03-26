import type { APIEvent } from "@solidjs/start/server";
import { getRequestEvent } from "solid-js/web";
import { Effect } from "effect";
import { HttpStatus } from "@tom/constants";
import { runSimpleEffect } from "~/libs/runtime";
import { ImageGenerationError } from "@tom/types";

export function GET({ request }: APIEvent) {
  const url = new URL(request.url);
  const title = url.searchParams.get("title");
  const summary = url.searchParams.get("summary");

  const event = getRequestEvent();
  const env = event?.nativeEvent.context.cloudflare?.env as { OG_SERVICE_URL?: string } | undefined;

  const program = Effect.gen(function* () {
    const upstreamUrl = env?.OG_SERVICE_URL;
    if (!upstreamUrl) {
      return yield* Effect.fail(
        new Response("OG service not configured", {
          status: HttpStatus.InternalServerError,
        }),
      );
    }

    const params = new URLSearchParams();
    if (title) params.set("title", title);
    if (summary) params.set("summary", summary);

    const targetUrl = `${upstreamUrl}/og?${params.toString()}&template=default`;

    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(targetUrl, {
          cf: {
            cacheTtl: 31536000,
            cacheEverything: true,
          },
        } as RequestInit),
      catch: () =>
        new ImageGenerationError({
          message: "Failed to fetch OG image",
        }),
    }).pipe(
      Effect.catchAll(
        Effect.fn("ogFetchErrorHandler")(function* (error: ImageGenerationError) {
          yield* Effect.logError("OG image proxy error", error);
          return yield* Effect.fail(
            new Response("Failed to fetch OG image", {
              status: HttpStatus.InternalServerError,
            }),
          );
        }),
      ),
    );

    if (!response.ok) {
      return yield* Effect.fail(
        new Response("Failed to generate OG image", {
          status: HttpStatus.InternalServerError,
        }),
      );
    }

    const imageBuffer = yield* Effect.tryPromise({
      try: () => response.arrayBuffer(),
      catch: () =>
        new ImageGenerationError({
          message: "Failed to read image buffer",
        }),
    }).pipe(
      Effect.catchAll(
        Effect.fn("ogBufferErrorHandler")(function* (error: ImageGenerationError) {
          yield* Effect.logError("Failed to read image buffer", error);
          return yield* Effect.fail(
            new Response("Failed to read image data", {
              status: HttpStatus.InternalServerError,
            }),
          );
        }),
      ),
    );

    return new Response(imageBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
        "CDN-Cache-Control": "public, max-age=31536000",
        "Cloudflare-CDN-Cache-Control": "public, max-age=31536000",
      },
    });
  });

  const action = program.pipe(Effect.catchAll((errorResponse) => Effect.succeed(errorResponse)));
  const loggedAction = Effect.gen(function* () {
    yield* Effect.logInfo("og:get:start");
    return yield* action.pipe(
      Effect.tap(() => Effect.logDebug("og:get:success")),
      Effect.catchAll(
        Effect.fn("ogLoggedErrorHandler")(function* (error: Response) {
          yield* Effect.logError("og:get:error", error);
          return yield* Effect.fail(error);
        }),
      ),
    );
  });

  return runSimpleEffect(loggedAction);
}

import type { APIEvent } from "@solidjs/start/server";
import { getRequestEvent } from "solid-js/web";
import { Effect } from "effect";
import { HttpStatus } from "@tom/constants";
import { makeScopedRunner, withActionLogs } from "@tom/utils";

const scope = "wwwtom:apps:web:api:og";
const run = makeScopedRunner(scope);

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
      catch: (error) => error,
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
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
      catch: (error) => error,
    }).pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
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

  return run(
    withActionLogs(
      "og:get",
      program.pipe(Effect.catchAll((errorResponse) => Effect.succeed(errorResponse))),
    ),
  );
}

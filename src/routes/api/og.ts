import type { APIEvent } from "@solidjs/start/server";
import { getRequestEvent } from "solid-js/web";
import { err, ok, ResultAsync } from "neverthrow";
import { logger, runServerEffect } from "~/libs/utils/logger";

export function GET({ request }: APIEvent) {
	const url = new URL(request.url);
	const title = url.searchParams.get("title");
	const summary = url.searchParams.get("summary");

	const event = getRequestEvent();
	const env = event?.nativeEvent.context.cloudflare?.env as
		| { OG_SERVICE_URL?: string }
		| undefined;

	const upstreamUrlResult = env?.OG_SERVICE_URL
		? ok(env.OG_SERVICE_URL)
		: err(new Response("OG service not configured", { status: 500 }));

	return upstreamUrlResult
		.asyncAndThen((upstreamUrl) => {
			const params = new URLSearchParams();
			if (title) params.set("title", title);
			if (summary) params.set("summary", summary);

			const targetUrl = `${upstreamUrl}/og/?${params.toString()}`;

			return ResultAsync.fromPromise(
				fetch(targetUrl, {
					cf: {
						cacheTtl: 31536000,
						cacheEverything: true,
					},
				} as RequestInit),
				(error) => {
					runServerEffect(logger.error("OG image proxy error:", error));
					return new Response("Failed to fetch OG image", { status: 500 });
				},
			);
		})
		.andThen((response) => {
			if (!response.ok) {
				return err(
					new Response("Failed to generate OG image", { status: 500 }),
				);
			}

			return ResultAsync.fromPromise(response.arrayBuffer(), (error) => {
				runServerEffect(logger.error("Failed to read image buffer:", error));
				return new Response("Failed to read image data", { status: 500 });
			});
		})
		.map((imageBuffer) => {
			return new Response(imageBuffer, {
				headers: {
					"Content-Type": "image/png",
					"Cache-Control": "public, max-age=31536000, immutable",
					"CDN-Cache-Control": "public, max-age=31536000",
					"Cloudflare-CDN-Cache-Control": "public, max-age=31536000",
				},
			});
		})
		.match(
			(response) => response,
			(errorResponse) => errorResponse,
		);
}

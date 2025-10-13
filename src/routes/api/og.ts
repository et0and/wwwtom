import type { APIEvent } from "@solidjs/start/server";
import { getRequestEvent } from "solid-js/web";

export async function GET({ request }: APIEvent) {
	const url = new URL(request.url);
	const title = url.searchParams.get("title");
	const summary = url.searchParams.get("summary");

	const event = getRequestEvent();
	const env = event?.nativeEvent.context.cloudflare?.env as
		| { OG_SERVICE_URL?: string }
		| undefined;

	const upstreamUrl = env?.OG_SERVICE_URL;

	if (!upstreamUrl) {
		return new Response("OG service not configured", { status: 500 });
	}

	const params = new URLSearchParams();
	if (title) params.set("title", title);
	if (summary) params.set("summary", summary);

	const targetUrl = `${upstreamUrl}/og/?${params.toString()}`;

	try {
		const response = await fetch(targetUrl, {
			cf: {
				cacheTtl: 31536000,
				cacheEverything: true,
			},
		} as RequestInit);

		if (!response.ok) {
			return new Response("Failed to generate OG image", { status: 500 });
		}

		const imageBuffer = await response.arrayBuffer();

		return new Response(imageBuffer, {
			headers: {
				"Content-Type": "image/png",
				"Cache-Control": "public, max-age=31536000, immutable",
				"CDN-Cache-Control": "public, max-age=31536000",
				"Cloudflare-CDN-Cache-Control": "public, max-age=31536000",
			},
		});
	} catch (error) {
		console.error("OG image proxy error:", error);
		return new Response("Failed to fetch OG image", { status: 500 });
	}
}

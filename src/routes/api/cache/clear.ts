import type { APIEvent } from "@solidjs/start/server";
import { invalidateAllPayloadCache } from "~/lib/api/payload/cache-invalidation";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit";

export async function POST({ request }: APIEvent) {
	"use server";

	const clientIp = getClientIp(request);
	const rateLimitKey = `cache-clear:${clientIp}`;

	const isAllowed = await checkRateLimit(rateLimitKey, {
		maxRequests: 5,
		windowMs: 60 * 60 * 1000,
	});

	if (!isAllowed) {
		return new Response(
			JSON.stringify({
				success: false,
				error: "Rate limit exceeded. Maximum 5 cache clears per hour.",
			}),
			{ status: 429, headers: { "Content-Type": "application/json" } },
		);
	}

	try {
		invalidateAllPayloadCache();
		return new Response(
			JSON.stringify({
				success: true,
				message: "Cache cleared successfully",
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	} catch (error) {
		return new Response(
			JSON.stringify({
				success: false,
				error: `Failed to clear cache: ${String(error)}`,
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}
}

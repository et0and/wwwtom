import { getRequestEvent } from "solid-js/web";

interface RateLimitConfig {
	maxRequests: number;
	windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
	maxRequests: 5,
	windowMs: 60 * 60 * 1000,
};

/**
 * Rate limit a request using Cloudflare KV store
 * Returns true if request is allowed, false if rate limited
 */
export async function checkRateLimit(
	key: string,
	config: RateLimitConfig = DEFAULT_CONFIG,
): Promise<boolean> {
	"use server";

	try {
		const event = getRequestEvent();
		const kv = event?.nativeEvent.context.cloudflare?.env?.TOM_RATE_LIMIT_KV;

		if (!kv) {
			console.warn(
				"TOM_RATE_LIMIT_KV not available, skipping rate limit check",
			);
			return true;
		}

		const now = Date.now();

		// Get current counter from KV
		const counterData = await kv.get(key, "json");
		const counter = counterData || { count: 0, resetAt: now + config.windowMs };

		// Check if window has expired
		if (now >= counter.resetAt) {
			// Reset counter
			await kv.put(
				key,
				JSON.stringify({
					count: 1,
					resetAt: now + config.windowMs,
				}),
				{ expirationTtl: Math.ceil(config.windowMs / 1000) },
			);
			return true;
		}

		// Check if under limit
		if (counter.count < config.maxRequests) {
			counter.count++;
			await kv.put(key, JSON.stringify(counter), {
				expirationTtl: Math.ceil(config.windowMs / 1000),
			});
			return true;
		}

		// Rate limited
		return false;
	} catch (error) {
		console.error("Rate limit check failed:", error);
		// Allow request if rate limit fails
		return true;
	}
}

/**
 * Get the client IP address from request
 */
export function getClientIp(request?: Request): string {
	if (!request) {
		const event = getRequestEvent();
		request = event?.request;
	}

	return (
		request?.headers.get("cf-connecting-ip") ||
		request?.headers.get("x-forwarded-for")?.split(",")[0] ||
		"unknown"
	);
}

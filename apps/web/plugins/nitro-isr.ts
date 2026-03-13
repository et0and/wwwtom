import type { NitroApp } from "nitropack";
import type { FetchEvent } from "vinxi/http";

/**
 * ISR plugin for Cloudflare Workers using the Cache API
 * This implements stale-while-revalidate caching at the edge
 */

interface ISRConfig {
	route: string;
	/** TTL in seconds - how long to cache at edge before revalidating */
	isr: number | false;
}

/**
 * Match a URL pathname against an ISR route pattern
 * Supports wildcards like "/work/**"
 */
function matchRoute(pathname: string, pattern: string): boolean {
	if (pattern === pathname) return true;

	// Convert pattern to regex
	const regexPattern = pattern
		.replace(/\*\*/g, "<<WILDCARD>>")
		.replace(/\*/g, "[^/]*")
		.replace(/<<WILDCARD>>/g, ".*");
	const regex = new RegExp(`^${regexPattern}$`);
	return regex.test(pathname);
}

/**
 * Find matching ISR config for a given pathname
 */
function findISRConfig(
	pathname: string,
	configs: Record<string, ISRConfig>,
): ISRConfig | null {
	for (const [pattern, config] of Object.entries(configs)) {
		if (matchRoute(pathname, pattern)) {
			return { ...config, route: pattern };
		}
	}
	return null;
}

/**
 * Simple defineNitroPlugin implementation
 */
type NitroPlugin = (nitroApp: NitroApp) => void | Promise<void>;
function defineNitroPlugin(plugin: NitroPlugin): NitroPlugin {
	return plugin;
}

export default defineNitroPlugin((nitroApp) => {
	// Get ISR route rules from Nitro config
	const routeRules = nitroApp.options.routeRules || {};

	// Convert route rules to ISR configs
	const isrConfigs: Record<string, ISRConfig> = {};
	for (const [route, rules] of Object.entries(routeRules)) {
		const typedRules = rules as { isr?: number | false };
		if (typedRules.isr !== undefined) {
			isrConfigs[route] = {
				route,
				isr: typedRules.isr,
			};
		}
	}

	// If no ISR configs, skip plugin setup
	if (Object.keys(isrConfigs).length === 0) {
		return;
	}

	// Hook into the request lifecycle
	nitroApp.hooks.hook("request", async (event: FetchEvent) => {
		const pathname = event.path || "/";

		// Find matching ISR config
		const config = findISRConfig(pathname, isrConfigs);
		if (!config || config.isr === false) {
			return; // Skip non-ISR routes
		}

		// Get Cloudflare cache
		const cache = caches?.default;
		if (!cache) {
			return; // No cache available
		}

		const cacheKey = new Request(
			`https://${event.headers.get("host") || "tom.so"}${pathname}`,
		);

		try {
			// Try to get cached response
			const cached = await cache.match(cacheKey);

			if (cached) {
				// Create a new response with ISR headers
				const newHeaders = new Headers(cached.headers);
				newHeaders.set("X-ISR", "HIT");
				newHeaders.set("X-ISR-Config", `${config.isr}s`);

				const body = await cached.text();
				const response = new Response(body, {
					status: cached.status,
					statusText: cached.statusText,
					headers: newHeaders,
				});

				event.respondWith(response);
				return;
			}
		} catch (error) {
			console.error("[ISR] Cache lookup error:", error);
		}
	});

	// Hook to cache the response after rendering
	nitroApp.hooks.hook("beforeResponse", async (event: FetchEvent) => {
		const pathname = event.path || "/";

		// Find matching ISR config
		const config = findISRConfig(pathname, isrConfigs);
		if (!config || config.isr === false) {
			return; // Skip non-ISR routes
		}

		// Get Cloudflare cache
		const cache = caches?.default;
		if (!cache) {
			return; // No cache available
		}

		// Only cache successful responses
		if (!event.response || event.response.status !== 200) {
			return;
		}

		try {
			const cacheKey = new Request(
				`https://${event.headers.get("host") || "tom.so"}${pathname}`,
			);

			// Clone the response for caching
			const responseToCache = event.response.clone();

			// Add ISR headers
			const newHeaders = new Headers(responseToCache.headers);
			newHeaders.set("X-ISR", "MISS");
			newHeaders.set("X-ISR-Config", `${config.isr}s`);

			// Create cacheable response with ISR TTL
			const cacheableResponse = new Response(
				await responseToCache.text(),
				{
					status: responseToCache.status,
					statusText: responseToCache.statusText,
					headers: newHeaders,
				},
			);

			// Store in cache with ISR TTL
			const ttlSeconds = config.isr as number;
			const expiration = new Date(Date.now() + ttlSeconds * 1000);
			cacheableResponse.headers.set("Expires", expiration.toUTCString());

			await cache.put(cacheKey, cacheableResponse);

			// Update the response headers
			const finalHeaders = new Headers(event.response.headers);
			finalHeaders.set("X-ISR", "MISS");
			finalHeaders.set("X-ISR-Config", `${config.isr}s`);

			const body = await event.response.text();
			event.response = new Response(body, {
				status: event.response.status,
				statusText: event.response.statusText,
				headers: finalHeaders,
			});
		} catch (error) {
			console.error("[ISR] Cache store error:", error);
		}
	});
});

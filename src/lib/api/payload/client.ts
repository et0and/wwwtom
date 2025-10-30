import { getRequestEvent } from "solid-js/web";
import { cache } from "~/lib/cache";

export interface PayloadPost {
	id: string;
	title: string;
	summary?: string;
	publishedAt: string;
	slug: string;
	content?: any;
	heroImage?: {
		url: string;
		alt?: string;
	};
	createdAt: string;
	updatedAt: string;
	meta?: {
		title?: string;
		description?: string;
		image?: any;
	};
}

export interface PayloadResponse<T> {
	docs: T;
	totalDocs: number;
	limit: number;
	page: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPrevPage: boolean;
}

export async function fetchPayload<T>(
	endpoint: string,
	options?: RequestInit & { cache?: boolean; cacheTTL?: number },
): Promise<T> {
	"use server";

	// Skip cache for write operations or when explicitly disabled
	const shouldCache =
		options?.cache !== false &&
		!endpoint.includes("POST") &&
		!endpoint.includes("PUT") &&
		!endpoint.includes("DELETE") &&
		!endpoint.includes("PATCH");

	const cacheKey = `payload:${endpoint}:${JSON.stringify(options)}`;

	// Try to get from cache first
	if (shouldCache) {
		const cached = cache.get<T>(cacheKey);
		if (cached) {
			console.log(`Cache HIT for ${endpoint}`);
			return cached;
		}
		console.log(`Cache MISS for ${endpoint}`);
	}

	const event = getRequestEvent();
	const env = event?.nativeEvent.context.cloudflare?.env as
		| { PAYLOAD_URL?: string; PAYLOAD_API_TOKEN?: string }
		| undefined;

	const PAYLOAD_URL =
		env?.PAYLOAD_URL || process.env.PAYLOAD_URL || import.meta.env.PAYLOAD_URL;
	const PAYLOAD_API_TOKEN =
		env?.PAYLOAD_API_TOKEN ||
		process.env.PAYLOAD_API_TOKEN ||
		import.meta.env.PAYLOAD_API_TOKEN;

	if (!PAYLOAD_URL) {
		throw new Error("PAYLOAD_URL environment variable is not set");
	}

	const url = `${PAYLOAD_URL}/api${endpoint}`;

	const headers: HeadersInit = {
		"Content-Type": "application/json",
		Origin: PAYLOAD_URL?.replace("/api", "") || "http://localhost:3000",
		Referer: PAYLOAD_URL?.replace("/api", "") || "http://localhost:3000",
		...(PAYLOAD_API_TOKEN && { Authorization: `Bearer ${PAYLOAD_API_TOKEN}` }),
		...options?.headers,
	};

	const response = await fetch(url, {
		...options,
		headers,
	});

	if (!response.ok) {
		throw new Error(
			`Payload API error: ${response.status} ${response.statusText}`,
		);
	}

	const data = await response.json();

	// Cache the response
	if (shouldCache) {
		cache.set(cacheKey, data, options?.cacheTTL);
	}

	return data;
}

export function invalidatePayloadCache(pattern?: string): void {
	if (pattern) {
		cache.invalidatePattern(pattern);
	} else {
		cache.invalidatePattern("^payload:");
	}
}

import { invalidatePayloadCache } from "./client";

/**
 * Invalidate cache for posts when content is updated
 */
export function invalidatePostsCache(): void {
	invalidatePayloadCache("^payload:/posts");
}

/**
 * Invalidate cache for works when content is updated
 */
export function invalidateWorksCache(): void {
	invalidatePayloadCache("^payload:/works");
}

/**
 * Invalidate cache for a specific post by slug
 */
export function invalidatePostBySlug(slug: string): void {
	invalidatePayloadCache(`^payload:/posts.*slug=${encodeURIComponent(slug)}`);
}

/**
 * Invalidate cache for a specific work by slug
 */
export function invalidateWorkBySlug(slug: string): void {
	invalidatePayloadCache(`^payload:/works.*slug=${encodeURIComponent(slug)}`);
}

/**
 * Invalidate all Payload CMS cache
 */
export function invalidateAllPayloadCache(): void {
	invalidatePayloadCache();
}

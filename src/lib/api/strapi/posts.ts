import { query } from "@solidjs/router";
import { fetchStrapi, type StrapiPost, type StrapiResponse } from "./client";

/**
 * Creates a query using the Strapi fetch client to return a paginated list of posts from Strapi organised by publication date. 
 * @param page - The page number to retrieve (default is 1).
 * @param pageSize - The number of posts per page (default is 5).
 * @returns A promise that resolves to a StrapiResponse containing an array of StrapiPost objects.
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 import { getPosts } from "~/lib/api/strapi";
 * const posts = createAsync(() => getPosts(currentPage()));
 * ```
 */
export const getPosts = query(
	async (page: number = 1, pageSize: number = 5) => {
		"use server";
		const response = await fetchStrapi<StrapiResponse<StrapiPost[]>>(
			`/posts?sort=publicationDate:desc&populate=*&pagination[page]=${page}&pagination[pageSize]=${pageSize}`,
		);
		return response;
	},
	"posts",
);

/**
 * Creates a query using the Strapi fetch client to return a single post from Strapi based on its slug.
 * The post content is parsed from Markdown to HTML using the marked library.
 * @param slug - The slug of the post to retrieve.
 * @returns A promise that resolves to a StrapiPost object or null if not found.
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 import { getPostBySlug } from "~/lib/api/strapi";
 * const post = createAsync(() => getPostBySlug(params.slug));
 * ```
 */
export const getPostBySlug = query(async (slug: string) => {
	"use server";
	const { marked } = await import("marked");
	const response = await fetchStrapi<StrapiResponse<StrapiPost[]>>(
		`/posts?filters[slug][$eq]=${slug}&populate=*`,
	);
	const post = response.data[0];
	if (!post) return null;
	return {
		...post,
		content: await marked.parse(post.content),
	};
}, "post");

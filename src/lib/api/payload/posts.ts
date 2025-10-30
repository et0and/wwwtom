import { query } from "@solidjs/router";
import { fetchPayload, type PayloadPost, type PayloadResponse } from "./client";
import { convertLexicalToHTML } from "./content-converter";

/**
 * Creates a query using the Payload fetch client to return a paginated list of posts from Payload organised by publication date.
 * @param page - The page number to retrieve (default is 1).
 * @param pageSize - The number of posts per page (default is 5).
 * @returns A promise that resolves to a response containing an array of PayloadPost objects.
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { getPosts } from "~/lib/api/payload";
 * const posts = createAsync(() => getPosts(currentPage()));
 * ```
 */
export const getPosts = query(
	async (page: number = 1, pageSize: number = 5) => {
		"use server";
		const response = await fetchPayload<PayloadResponse<PayloadPost[]>>(
			`/posts?sort=-publishedAt&limit=${pageSize}&page=${page}&depth=1`,
		);
		return {
			data: response.docs,
			meta: {
				pagination: {
					page: response.page,
					pageSize: response.limit,
					pageCount: response.totalPages,
					total: response.totalDocs,
				},
			},
		};
	},
	"posts",
);

/**
 * Creates a query using the Payload fetch client to return a single post from Payload based on its slug.
 * The post content is parsed from rich text to HTML.
 * @param slug - The slug of the post to retrieve.
 * @returns A promise that resolves to a PayloadPost object or null if not found.
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { getPostBySlug } from "~/lib/api/payload";
 * const post = createAsync(() => getPostBySlug(params.slug));
 * ```
 */
export const getPostBySlug = query(async (slug: string) => {
	"use server";
	const response = await fetchPayload<PayloadResponse<PayloadPost[]>>(
		`/posts?where%5Bslug%5D%5Bequals%5D=${encodeURIComponent(slug)}&limit=1&depth=3`,
	);
	const post = response.docs[0];
	if (!post) return null;

	let content = "<p>No content available</p>";

	if (post.content && typeof post.content === "object" && post.content.root) {
		content = convertLexicalToHTML(post.content.root);
	} else if (typeof post.content === "string") {
		content = post.content;
	}

	return {
		...post,
		content,
	};
}, "post");

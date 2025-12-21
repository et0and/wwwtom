import { query } from "@solidjs/router";
import type { PayloadPost, PayloadResponse } from "../../schemas/payload";
import { convertLexicalToHTML, extractArenaBlocks } from "./content-converter";
import { fetchPayload } from "./client";
import { Effect } from "effect";

export type PostsResponse = {
	data: PayloadPost[];
	meta: {
		pagination: {
			page: number;
			pageSize: number;
			pageCount: number;
			total: number;
		};
	};
	error?: string;
};

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

		const effect = fetchPayload<PayloadResponse<PayloadPost>>(
			`/posts?sort=-publishedAt&limit=${pageSize}&page=${page}&depth=1`,
		).pipe(
			Effect.map((response) => ({
				data: response.docs,
				meta: {
					pagination: {
						page: response.page,
						pageSize: response.limit,
						pageCount: response.totalPages,
						total: response.totalDocs,
					},
				},
			})),
			Effect.catchAll((error) =>
				Effect.succeed({
					data: [],
					meta: {
						pagination: { page: 1, pageSize: 5, pageCount: 0, total: 0 },
					},
					error: error instanceof Error ? error.message : String(error),
				}),
			),
		);
		return Effect.runPromise(effect);
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

	const effect = fetchPayload<PayloadResponse<PayloadPost>>(
		`/posts?where%5Bslug%5D%5Bequals%5D=${encodeURIComponent(slug)}&limit=1&depth=3`,
	).pipe(
		Effect.map((response) => {
			const post = response.docs[0];
			if (!post) return null;

			let content = "<p>No content available</p>";
			let arenaBlocks: ReturnType<typeof extractArenaBlocks> = [];

			if (
				post.content &&
				typeof post.content === "object" &&
				"root" in post.content &&
				post.content.root
			) {
				arenaBlocks = extractArenaBlocks(post.content.root);
				content = convertLexicalToHTML(post.content.root);
			} else if (typeof post.content === "string") {
				content = post.content;
			}

			return {
				id: String(post.id),
				title: post.title,
				summary: post.summary,
				publishedAt: post.publishedAt,
				slug: post.slug,
				content,
				arenaBlocks,
				heroImage: post.heroImage,
				arenaSlug: post.arenaSlug,
				arenaTitle: post.arenaTitle,
				createdAt: post.createdAt,
				updatedAt: post.updatedAt,
				meta: post.meta,
			};
		}),
		Effect.catchAll(() => Effect.succeed(null)),
	);
	return Effect.runPromise(effect);
}, "post");

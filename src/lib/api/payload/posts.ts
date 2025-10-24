import { query } from "@solidjs/router";
import { fetchPayload, type PayloadPost, type PayloadResponse } from "./client";

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
		`/posts?where[slug][equals]=${slug}&limit=1&depth=3`,
	);
	const post = response.docs[0];
	if (!post) return null;

	let content = "<p>No content available</p>";

	if (post.content && typeof post.content === "object") {
		// Simple recursive converter for Payload lexical content
		const convertNode = (node: any): string => {
			if (!node) return "";

			// Handle root node
			if (node.type === "root" && node.children) {
				return node.children.map(convertNode).join("");
			}

			// Handle paragraphs
			if (node.type === "paragraph" && node.children) {
				const text = node.children
					.map((child: any) => {
						if (child.type === "text") {
							return child.text || "";
						}
						return convertNode(child);
					})
					.join("");
				return `<p>${text}</p>`;
			}

			// Handle headings
			if (node.type === "heading" && node.children) {
				const text = node.children
					.map((child: any) => {
						if (child.type === "text") {
							return child.text || "";
						}
						return convertNode(child);
					})
					.join("");
				const level = node.tag || "h2";
				return `<${level}>${text}</${level}>`;
			}

			// Handle text nodes
			if (node.type === "text") {
				return node.text || "";
			}

			// Handle blocks (banners, media, etc.)
			if (node.type === "block" && node.fields) {
				if (node.fields.blockType === "banner" && node.fields.content) {
					const bannerContent = convertNode(node.fields.content);
					return `<div class="banner">${bannerContent}</div>`;
				}

				if (node.fields.blockType === "mediaBlock" && node.fields.media) {
					const media = node.fields.media;
					return `<figure class="media-block">
						<img src="${media.url}" alt="${media.alt || ""}" />
					</figure>`;
				}
			}

			return "";
		};

		content = convertNode(post.content.root);
	} else if (typeof post.content === "string") {
		content = post.content;
	}

	return {
		...post,
		content,
	};
}, "post");

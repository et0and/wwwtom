import { query } from "@solidjs/router";
import { fetchPayload, type PayloadPost, type PayloadResponse } from "./client";

/**
 * Creates a query using the Payload fetch client to return a list of works from Payload organised by title.
 * @returns A promise that resolves to an array of PayloadPost objects.
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { getWorks } from "~/lib/api/payload";
 * const works = createAsync(() => getWorks());
 * ```
 */
export const getWorks = query(async () => {
	"use server";
	const response =
		await fetchPayload<PayloadResponse<PayloadPost[]>>("/works?sort=title");
	return response.docs;
}, "works");

/**
 * Creates a query using the Payload fetch client to return a single work post from Payload based on its slug.
 * The content is parsed from rich text to HTML.
 * @param slug - The slug of the work item to retrieve.
 * @returns A promise that resolves to a PayloadPost object or null if not found.
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { getWorkBySlug } from "~/lib/api/payload";
 * const work = createAsync(() => getWorkBySlug(params.slug));
 * ```
 */
export const getWorkBySlug = query(async (slug: string) => {
	"use server";
	const response = await fetchPayload<PayloadResponse<PayloadPost[]>>(
		`/works?where%5Bslug%5D%5Bequals%5D=${encodeURIComponent(slug)}&limit=1&depth=3`,
	);
	const work = response.docs[0];
	if (!work) return null;

	// Convert Payload lexical content to HTML (same function as posts)
	const convertLexicalToHTML = (node: any): string => {
		if (!node) return "";

		if (node.type === "root" && node.children) {
			return node.children.map(convertLexicalToHTML).join("");
		}

		if (node.type === "paragraph" && node.children) {
			const text = node.children
				.map((child: any) => {
					if (child.type === "text") {
						let text = child.text || "";
						if (child.format & 1) text = `<strong>${text}</strong>`;
						if (child.format & 2) text = `<em>${text}</em>`;
						return text;
					} else if (child.type === "link" && child.fields && child.children) {
						const linkText = child.children
							.map((c: any) => c.text || "")
							.join("");
						const url = child.fields.url || "#";
						const newTab = child.fields.newTab
							? ' target="_blank" rel="noopener"'
							: "";
						return `<a href="${url}"${newTab}>${linkText}</a>`;
					}
					return convertLexicalToHTML(child);
				})
				.join("");
			return `<p>${text}</p>`;
		}

		if (node.type === "heading" && node.children) {
			const text = node.children
				.map((child: any) => {
					if (child.type === "text") {
						let text = child.text || "";
						if (child.format & 1) text = `<strong>${text}</strong>`;
						if (child.format & 2) text = `<em>${text}</em>`;
						return text;
					}
					return convertLexicalToHTML(child);
				})
				.join("");
			const level = node.tag || "h2";
			return `<${level}>${text}</${level}>`;
		}

		if (node.type === "block" && node.fields) {
			if (node.fields.blockType === "banner" && node.fields.content) {
				const bannerContent = convertLexicalToHTML(node.fields.content);
				return `<div class="banner banner-${node.fields.style || "default"}">${bannerContent}</div>`;
			}

			if (node.fields.blockType === "mediaBlock" && node.fields.media) {
				const media = node.fields.media;
				const caption = media.caption
					? convertLexicalToHTML(media.caption)
					: "";
				return `<figure class="media-block">
					<img src="${media.url}" alt="${media.alt || ""}" />
					${caption ? `<figcaption>${caption}</figcaption>` : ""}
				</figure>`;
			}
		}

		if (node.type === "text") {
			let text = node.text || "";
			if (node.format & 1) text = `<strong>${text}</strong>`;
			if (node.format & 2) text = `<em>${text}</em>`;
			return text;
		}

		return "";
	};

	let content = "<p>No content available</p>";

	if (work.content && typeof work.content === "object") {
		content = convertLexicalToHTML(work.content.root);
	} else if (typeof work.content === "string") {
		content = work.content;
	}

	return {
		...work,
		content,
	};
}, "work");

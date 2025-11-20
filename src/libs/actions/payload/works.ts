import { query } from "@solidjs/router";
import { type PayloadPost, type PayloadResponse } from "../../types/payload";
import { convertLexicalToHTML } from "./content-converter";
import { fetchPayload } from "./client";

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
	return fetchPayload<PayloadResponse<PayloadPost[]>>(
		"/works?sort=title",
	).match(
		(response) => response.docs,
		(error) => {
			throw error;
		},
	);
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
	return fetchPayload<PayloadResponse<PayloadPost[]>>(
		`/works?where%5Bslug%5D%5Bequals%5D=${encodeURIComponent(slug)}&limit=1&depth=3`,
	)
		.map((response) => {
			const work = response.docs[0];
			if (!work) return null;

			let content = "<p>No content available</p>";

			if (
				work.content &&
				typeof work.content === "object" &&
				work.content.root
			) {
				content = convertLexicalToHTML(work.content.root);
			} else if (typeof work.content === "string") {
				content = work.content;
			}

			return {
				...work,
				content,
			};
		})
		.match(
			(work) => work,
			(error) => {
				throw error;
			},
		);
}, "work");

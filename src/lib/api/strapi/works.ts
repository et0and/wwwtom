import { query } from "@solidjs/router";
import { fetchStrapi, type StrapiPost, type StrapiResponse } from "./client";

/**
 * Creates a query using the Strapi fetch client to return a list of works from Strapi organised by title.
 * @param slug - The slug of work posts to retrieve, organised by title in alphabetical order.
 * @returns A promise that resolves to an array of StrapiPost objects.
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { getWorks } from "~/lib/api/strapi";
 * const works = createAsync(() => getWorks());
 * ```
 */
export const getWorks = query(async () => {
	"use server";
	const response = await fetchStrapi<StrapiResponse<StrapiPost[]>>(
		"/works?sort=title:asc&populate=*",
	);
	return response.data;
}, "works");

/**
 * Creates a query using the Strapi fetch client to return a single work post from Strapi based on its slug.
 * The content is parsed from Markdown to HTML using the marked library.
 * @param slug - The slug of the work item to retrieve.
 * @returns A promise that resolves to a StrapiPost object or null if not found.
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { getWorkBySlug } from "~/lib/api/strapi";
 * const work = createAsync(() => getWorkBySlug(params.slug));
 * ```
 */
export const getWorkBySlug = query(async (slug: string) => {
	"use server";
	const { marked } = await import("marked");
	const response = await fetchStrapi<StrapiResponse<StrapiPost[]>>(
		`/works?filters[slug][$eq]=${slug}&populate=*`,
	);
	const work = response.data[0];
	if (!work) return null;
	return {
		...work,
		content: await marked.parse(work.content),
	};
}, "work");

import { query } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";

export interface StrapiPost {
	id: number;
	documentId: string;
	title: string;
	summary: string;
	publishedAt: string;
	publicationDate?: string;
	slug: string;
	content: string;
	featuredImage?: {
		url: string;
		alternativeText?: string;
	};
	createdAt: string;
	updatedAt: string;
	locale?: string;
}

export interface StrapiResponse<T> {
	data: T;
	meta: {
		pagination?: {
			page: number;
			pageSize: number;
			pageCount: number;
			total: number;
		};
	};
}

async function fetchStrapi<T>(
	endpoint: string,
	options?: RequestInit,
): Promise<T> {
	"use server";
	const event = getRequestEvent();
	const env = event?.nativeEvent.context.cloudflare?.env as
		| { STRAPI_URL?: string; STRAPI_API_TOKEN?: string }
		| undefined;

	const STRAPI_URL =
		env?.STRAPI_URL || process.env.STRAPI_URL || import.meta.env.STRAPI_URL;
	const STRAPI_API_TOKEN =
		env?.STRAPI_API_TOKEN ||
		process.env.STRAPI_API_TOKEN ||
		import.meta.env.STRAPI_API_TOKEN;

	if (!STRAPI_URL) {
		throw new Error("STRAPI_URL environment variable is not set");
	}

	const url = `${STRAPI_URL}/api${endpoint}`;

	const headers: HeadersInit = {
		"Content-Type": "application/json",
		...(STRAPI_API_TOKEN && { Authorization: `Bearer ${STRAPI_API_TOKEN}` }),
		...options?.headers,
	};

	const response = await fetch(url, {
		...options,
		headers,
	});

	if (!response.ok) {
		throw new Error(
			`Strapi API error: ${response.status} ${response.statusText}`,
		);
	}

	return response.json();
}

export const getPosts = query(async () => {
	"use server";
	const response = await fetchStrapi<StrapiResponse<StrapiPost[]>>(
		"/posts?sort=publicationDate:desc&populate=*",
	);
	return response.data;
}, "posts");

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

export const getWorks = query(async () => {
	"use server";
	const response = await fetchStrapi<StrapiResponse<StrapiPost[]>>(
		"/works?sort=title:asc&populate=*",
	);
	return response.data;
}, "works");

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

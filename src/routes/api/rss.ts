import RSS from "rss";
import {
	fetchPayload,
	type PayloadResponse,
	type PayloadPost,
} from "~/lib/api/payload/client";

export async function GET() {
	const feed = new RSS({
		title: "wwwtom blog",
		description: "Latest blog posts from wwwtom",
		feed_url: "https://www.tom.so/api/rss",
		site_url: "https://www.tom.so",
		language: "en",
		pubDate: new Date(),
	});

	try {
		const response = await fetchPayload<PayloadResponse<PayloadPost[]>>(
			"/posts?sort=-publishedAt&limit=20&depth=1",
		);

		for (const post of response.docs) {
			const content = post.summary || "";
			const postUrl = `https://www.tom.so/posts/${post.slug}`;

			feed.item({
				title: post.title,
				description: content,
				url: postUrl,
				guid: post.id,
				date: new Date(post.publishedAt),
				author: "wwwtom",
			});
		}

		const xml = feed.xml({ indent: true });

		return new Response(xml, {
			headers: {
				"Content-Type": "application/rss+xml",
				"Cache-Control": "public, max-age=3600",
			},
		});
	} catch (error) {
		console.error("Error generating RSS feed:", error);
		return new Response("Error generating RSS feed", { status: 500 });
	}
}

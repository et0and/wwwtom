import RSS from "rss";
import {
	fetchPayload,
	type PayloadResponse,
	type PayloadPost,
} from "~/lib/api/payload/client";

export async function GET() {
	const feed = new RSS({
		title: "Tom Hackshaw",
		description: "Latest blog posts from Tom Hackshaw",
		feed_url: "https://tom.so/api/rss",
		site_url: "https://tom.so",
		language: "en_NZ",
		pubDate: new Date(),
	});

	try {
		const response = await fetchPayload<PayloadResponse<PayloadPost[]>>(
			"/posts?sort=-publishedAt&limit=20&depth=1",
		);

		for (const post of response.docs) {
			const content = post.summary || post.meta?.description || "";
			const postUrl = `https://www.tom.so/posts/${post.slug}`;

			feed.item({
				title: post.title,
				description: content,
				url: postUrl,
				guid: post.id,
				date: new Date(post.publishedAt),
				author: "Tom Hackshaw",
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

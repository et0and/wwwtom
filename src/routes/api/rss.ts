import RSS from "rss";
import { fetchPayload } from "~/libs/actions/payload/client";
import type { PayloadPost, PayloadResponse } from "~/libs/types/payload";
import { logger, runServerEffect } from "~/libs/utils/logger";

export function GET() {
	const feed = new RSS({
		title: "Tom Hackshaw",
		description: "Latest blog posts from Tom Hackshaw",
		feed_url: "https://tom.so/api/rss",
		site_url: "https://tom.so",
		language: "en_NZ",
	});

	return fetchPayload<PayloadResponse<PayloadPost[]>>(
		"/posts?sort=-publishedAt&limit=20&depth=1",
	)
		.map((response) => {
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

			return feed.xml({ indent: true });
		})
		.match(
			(xml) =>
				new Response(xml, {
					headers: {
						"Content-Type": "application/rss+xml",
						"Cache-Control": "public, max-age=3600",
					},
				}),
			(error) => {
				runServerEffect(logger.error("Error generating RSS feed:", error));
				return new Response("Error generating RSS feed", { status: 500 });
			},
		);
}

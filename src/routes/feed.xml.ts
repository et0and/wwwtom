import RSS from "rss";
import { Effect } from "effect";
import { fetchPayload } from "~/libs/actions/payload/client";
import type { PayloadPost, PayloadResponse } from "~/libs/schemas/payload";
import { logger } from "~/libs/utils/logger";

export async function GET() {
	const feed = new RSS({
		title: "Tom Hackshaw",
		description: "Latest blog posts from Tom Hackshaw",
		feed_url: "https://tom.so/feed.xml",
		site_url: "https://tom.so",
		language: "en_NZ",
	});

	const effect = fetchPayload<PayloadResponse<PayloadPost>>(
		"/posts?sort=-publishedAt&limit=20&depth=1",
	).pipe(
		Effect.map((response) => {
			for (const post of response.docs) {
				const content = post.summary || post.meta?.description || "";
				const postUrl = `https://tom.so/posts/${post.slug}`;

				feed.item({
					title: post.title,
					description: content,
					url: postUrl,
					guid: String(post.id),
					date: new Date(post.publishedAt),
					author: "Tom Hackshaw",
				});
			}

			return feed.xml({ indent: true });
		}),
		Effect.match({
			onSuccess: (xml) =>
				new Response(xml, {
					headers: {
						"Content-Type": "application/rss+xml",
						"Cache-Control": "public, max-age=3600",
					},
				}),
			onFailure: (error) => {
				logger.error("Error generating RSS feed:", error);
				return new Response("Error generating RSS feed", { status: 500 });
			},
		}),
	);

	return Effect.runPromise(effect);
}

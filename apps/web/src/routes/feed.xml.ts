import RSS from "rss";
import { Effect } from "effect";
import { callAdapter, adapterRequest } from "~/libs/adapter";
import { HttpStatus } from "@tom/constants/http";

export function GET() {
  return Effect.runPromise(
    adapterRequest(() => callAdapter().payload.feed.get({ query: { limit: 20 } })).pipe(
      Effect.map(({ docs }) => {
        const feed = new RSS({
          title: "Tom Hackshaw",
          description: "Latest blog posts from Tom Hackshaw",
          feed_url: "https://tom.so/feed.xml",
          site_url: "https://tom.so",
          language: "en_NZ",
        });

        for (const post of docs) {
          const postUrl = `https://tom.so/posts/${post.slug}`;

          feed.item({
            title: post.title,
            description: post.summary,
            url: postUrl,
            guid: post.id,
            date: new Date(post.publishedAt),
            author: "Tom Hackshaw",
            custom_elements: [{ "content:encoded": post.content }],
          });
        }

        return new Response(feed.xml({ indent: true }), {
          headers: {
            "Content-Type": "application/rss+xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }),
      Effect.catch((error) =>
        Effect.succeed(
          new Response("Error generating RSS feed", {
            status: HttpStatus.InternalServerError,
            headers: { "Content-Type": "text/plain" },
            statusText: error.message,
          }),
        ),
      ),
    ),
  );
}

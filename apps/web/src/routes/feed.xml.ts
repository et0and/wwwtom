import RSS from "rss";
import { Effect } from "effect";
import { PayloadService } from "@tom/payload/service";
import { convertLexicalToHTML } from "~/libs/actions/payload/content-converter";
import type { PayloadPost, PayloadResponse } from "@tom/schemas";
import { HttpStatus } from "@tom/constants";
import { runEffect, getServiceLayer } from "~/libs/runtime";

export async function GET() {
  const layer = getServiceLayer();
  const feed = new RSS({
    title: "Tom Hackshaw",
    description: "Latest blog posts from Tom Hackshaw",
    feed_url: "https://tom.so/feed.xml",
    site_url: "https://tom.so",
    language: "en_NZ",
  });

  return runEffect(
    Effect.gen(function* () {
      const payload = yield* Effect.service(PayloadService);
      yield* Effect.logInfo("feed:fetch:start");

      const response = yield* payload.fetch<PayloadResponse<PayloadPost>>(
        "/posts?sort=-publishedAt&limit=20&depth=3",
      );

      for (const post of response.docs) {
        const postUrl = `https://tom.so/posts/${post.slug}`;

        const summary = post.summary ?? post.meta?.description ?? "";
        let content = "";
        if (typeof post.content === "string") {
          content = post.content;
        } else if (post.content?.root) {
          const contentRoot = post.content.root;
          content = yield* Effect.tryPromise({
            try: () => convertLexicalToHTML(contentRoot),
            catch: () => "<p>Error rendering content</p>",
          });
        }

        feed.item({
          title: post.title,
          description: summary,
          url: postUrl,
          guid: String(post.id),
          date: new Date(post.publishedAt),
          author: "Tom Hackshaw",
          custom_elements: [{ "content:encoded": content }],
        });
      }

      yield* Effect.logInfo("feed:fetch:success");

      return new Response(feed.xml({ indent: true }), {
        headers: {
          "Content-Type": "application/rss+xml",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }).pipe(
      Effect.catch((error) =>
        Effect.succeed(
          new Response("Error generating RSS feed", {
            status: HttpStatus.InternalServerError,
            headers: { "Content-Type": "text/plain" },
            statusText: String(error instanceof Error ? error.message : error),
          }),
        ),
      ),
    ),
    layer,
  );
}

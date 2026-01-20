import RSS from "rss";
import { Effect } from "effect";
import { fetchPayload } from "~/libs/actions/payload/client";
import { convertLexicalToHTML } from "~/libs/actions/payload/content-converter";
import type { PayloadPost, PayloadResponse } from "@tom/payload";
import { HttpStatus } from "@tom/constants";
import { makeScopedRunner, withActionLogs } from "@tom/utils";

const scope = "wwwtom:apps:web:api:feed";
const run = makeScopedRunner(scope);

export async function GET() {
  const feed = new RSS({
    title: "Tom Hackshaw",
    description: "Latest blog posts from Tom Hackshaw",
    feed_url: "https://tom.so/feed.xml",
    site_url: "https://tom.so",
    language: "en_NZ",
  });

  const effect = fetchPayload<PayloadResponse<PayloadPost>>(
    "/posts?sort=-publishedAt&limit=20&depth=3",
  ).pipe(
    Effect.tap(() => Effect.logInfo("feed:fetch")),
    Effect.map((response) => {
      for (const post of response.docs) {
        const postUrl = `https://tom.so/posts/${post.slug}`;

        const summary = post.summary || post.meta?.description || "";
        let content = "";
        if (typeof post.content === "string") {
          content = post.content;
        } else if (post.content?.root) {
          content = convertLexicalToHTML(post.content.root);
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
      onFailure: (error) =>
        new Response("Error generating RSS feed", {
          status: HttpStatus.InternalServerError,
          headers: { "Content-Type": "text/plain" },
          statusText: String(error instanceof Error ? error.message : error),
        }),
    }),
  );

  return run(withActionLogs("feed:get", effect));
}

import RSS from "rss";
import { Effect } from "effect";
import { callAdapter, adapterRequest } from "~/libs/adapter";
import { HttpStatus } from "@tom/constants/http";

/**
 * Non-HTML endpoints the web Worker serves before page rendering
 * (SolidStart's GET routes moved here; dispatched from src/middleware.ts).
 */

export const handleFeed = () =>
  Effect.runPromise(
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

export const handleSitemap = () =>
  Effect.runPromise(
    Effect.all([
      adapterRequest(() => callAdapter().payload.posts.get({ query: { page: 1, pageSize: 500 } })),
      adapterRequest(() => callAdapter().payload.works.get({ query: { sort: "-updatedAt" } })),
    ]).pipe(
      Effect.map(([postsResult, worksResult]) => {
        const posts = postsResult.data;
        const works = worksResult;

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://tom.so/</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://tom.so/posts</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
${posts
  .map(
    (post) => `
  <url>
    <loc>https://tom.so/posts/${post.slug}</loc>
    <lastmod>${new Date(post.updatedAt).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`,
  )
  .join("")}
  <url>
    <loc>https://tom.so/work</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
${works
  .map(
    (work) => `
  <url>
    <loc>https://tom.so/work/${work.slug}</loc>
    <lastmod>${new Date(work.updatedAt).toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`,
  )
  .join("")}
</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }),
      Effect.catch((error) =>
        Effect.succeed(
          new Response(`<?xml version="1.0" encoding="UTF-8"?><error>${error.message}</error>`, {
            status: HttpStatus.InternalServerError,
            headers: { "Content-Type": "application/xml" },
          }),
        ),
      ),
    ),
  );

export const handleRobots = () =>
  new Response(
    `User-agent: *
Allow: /
Sitemap: https://tom.so/sitemap.xml`,
    {
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "public, max-age=86400",
      },
    },
  );

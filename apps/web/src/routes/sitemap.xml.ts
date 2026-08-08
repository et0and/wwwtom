import { Effect } from "effect";
import { callAdapter, adapterRequest } from "~/libs/adapter";
import { HttpStatus } from "@tom/constants";

export function GET() {
  return Effect.runPromise(
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
}

import { fetchPayload } from "~/libs/actions/payload/client";
import type { PayloadResponse, PayloadPost } from "@tom/payload";
import { Effect } from "effect";
import { HttpStatus } from "@tom/constants";
import { makeScopedRunner, withActionLogs } from "@tom/utils";

const scope = "wwwtom:apps:web:api:sitemap";
const run = makeScopedRunner(scope);

export async function GET() {
  const effect = Effect.gen(function* () {
    const [posts, works] = yield* Effect.all([
      fetchPayload<PayloadResponse<PayloadPost>>("/posts?sort=-publishedAt&limit=500&depth=0"),
      fetchPayload<PayloadResponse<PayloadPost>>("/works?sort=-updatedAt&limit=500&depth=0"),
    ]);

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
${posts.docs
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
${works.docs
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
  }).pipe(
    Effect.catchAll((error) =>
      Effect.succeed(
        new Response(`<?xml version="1.0" encoding="UTF-8"?><error>${error.message}</error>`, {
          status: HttpStatus.InternalServerError,
          headers: { "Content-Type": "application/xml" },
        }),
      ),
    ),
  );

  return run(withActionLogs("sitemap:get", effect));
}

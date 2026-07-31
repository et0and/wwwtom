import { Effect } from "effect";
import { PayloadService } from "@tom/payload/service";
import type { PayloadPost, PayloadResponse, PayloadWork } from "@tom/schemas";
import { HttpStatus } from "@tom/constants";
import { runEffect, getServiceLayer, gen } from "~/libs/runtime";

export async function GET() {
  const layer = getServiceLayer();
  return runEffect(
    gen(function* () {
      const payload = yield* PayloadService;
      yield* Effect.logInfo("sitemap:fetch:start");

      const [posts, works] = yield* Effect.all([
        payload.fetch<PayloadResponse<PayloadPost>>("/posts?sort=-publishedAt&limit=500&depth=0"),
        payload.fetch<PayloadResponse<PayloadWork>>("/works?sort=-updatedAt&limit=500&depth=0"),
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

      yield* Effect.logInfo("sitemap:fetch:success");

      return new Response(xml, {
        headers: {
          "Content-Type": "application/xml",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }).pipe(
      Effect.catch((error) =>
        Effect.succeed(
          new Response(
            `<?xml version="1.0" encoding="UTF-8"?><error>${error instanceof Error ? error.message : String(error)}</error>`,
            {
              status: HttpStatus.InternalServerError,
              headers: { "Content-Type": "application/xml" },
            },
          ),
        ),
      ),
    ),
    layer,
  );
}

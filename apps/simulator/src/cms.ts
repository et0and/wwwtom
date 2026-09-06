import { Elysia } from "elysia";
import { Schema } from "effect";
import { CmsPostSchema, CmsWorkSchema } from "@tom/schemas/cms";
import type { CmsPost, CmsWork } from "@tom/schemas/cms";
import postFixtures from "../fixtures/cms-posts.json" with { type: "json" };
import workFixtures from "../fixtures/cms-works.json" with { type: "json" };

/**
 * Fixture data simulates API responses. The JSON stays dumb data; the
 * shapes come from the real CMS schemas via decode (a direct `as` cast
 * cannot bridge JSON literals to branded schema types) — never redeclared
 * here. A drifting fixture fails at boot instead of rendering nonsense.
 */
const posts = Schema.decodeUnknownSync(Schema.Array(CmsPostSchema))(postFixtures);
const works = Schema.decodeUnknownSync(Schema.Array(CmsWorkSchema))(workFixtures);

type CmsDoc = CmsPost | CmsWork;

const byPublishedDesc = (a: CmsDoc, b: CmsDoc): number =>
  (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");

const byTitleAsc = (a: CmsDoc, b: CmsDoc): number =>
  a.title.localeCompare(b.title, undefined, { sensitivity: "base" });

/**
 * Minimal CMS list shape ({ docs, totalDocs, ... }). Serves published docs
 * only — posts newest first, works alphabetical — the same contract as the
 * real API (apps/api).
 */
const listResponse = (
  docs: ReadonlyArray<CmsDoc>,
  page: number,
  limit: number,
  sort: (a: CmsDoc, b: CmsDoc) => number,
) => {
  const published = docs.filter((doc) => doc.status === "published").sort(sort);
  const totalDocs = published.length;
  const totalPages = limit > 0 ? Math.ceil(totalDocs / limit) : 1;
  return {
    docs: published.slice((page - 1) * limit, page * limit),
    totalDocs,
    limit,
    page,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

const findPublished = (docs: ReadonlyArray<CmsDoc>, slug: string): CmsDoc | undefined =>
  [...docs].sort(byPublishedDesc).find((doc) => doc.slug === slug && doc.status === "published");

const listQuery = Schema.toStandardSchemaV1(
  Schema.Struct({
    page: Schema.optional(Schema.NumberFromString),
    pageSize: Schema.optional(Schema.NumberFromString),
    limit: Schema.optional(Schema.NumberFromString),
  }),
);

const slugParams = Schema.toStandardSchemaV1(Schema.Struct({ slug: Schema.String }));

const idParams = Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String }));

const single = (doc: CmsDoc | undefined, set: { status?: number | string }) => {
  if (!doc) {
    set.status = 404;
    return { error: "Not found" };
  }
  return doc;
};

/** 1x1 red PNG: media file bytes for e2e image assertions. */
const RedPixelPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export const cmsSimulator = new Elysia({ name: "cms-simulator" })
  .get(
    "/posts",
    ({ query }) =>
      listResponse(posts, query.page ?? 1, query.pageSize ?? query.limit ?? 10, byPublishedDesc),
    {
      query: listQuery,
      detail: { description: "Simulated CMS posts", tags: ["cms"] },
    },
  )
  .get("/posts/:slug", ({ params, set }) => single(findPublished(posts, params.slug), set), {
    params: slugParams,
    detail: { description: "Simulated CMS post by slug", tags: ["cms"] },
  })
  .get(
    "/works",
    ({ query }) =>
      listResponse(works, query.page ?? 1, query.pageSize ?? query.limit ?? 10, byTitleAsc),
    {
      query: listQuery,
      detail: { description: "Simulated CMS works", tags: ["cms"] },
    },
  )
  .get("/works/:slug", ({ params, set }) => single(findPublished(works, params.slug), set), {
    params: slugParams,
    detail: { description: "Simulated CMS work by slug", tags: ["cms"] },
  })
  .get("/categories", () => [], {
    detail: { description: "Simulated CMS categories", tags: ["cms"] },
  })
  .get(
    "/media/:id",
    ({ set }) => {
      set.status = 404;
      return { error: "Not found" };
    },
    {
      params: idParams,
      detail: { description: "Simulated CMS media by id", tags: ["cms"] },
    },
  )
  .get(
    "/media/:id/file",
    () =>
      new Response(Buffer.from(RedPixelPngBase64, "base64"), {
        headers: { "Content-Type": "image/png", "Cache-Control": "immutable, max-age=31536000" },
      }),
    {
      params: idParams,
      detail: { description: "Simulated media file bytes", tags: ["cms"] },
    },
  );

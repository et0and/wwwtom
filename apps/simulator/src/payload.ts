import { Elysia } from "elysia";
import { Schema } from "effect";
import postFixtures from "../fixtures/payload-posts.json" with { type: "json" };
import workFixtures from "../fixtures/payload-works.json" with { type: "json" };

type PayloadDoc = { slug: string; publishedAt?: string; updatedAt?: string; title: string };

const posts = postFixtures as PayloadDoc[];
const works = workFixtures as PayloadDoc[];

/**
 * Minimal Payload REST shape ({ docs, totalDocs, ... }). The adapter's
 * PayloadService only reads `docs` (plus page/limit fields we keep honest),
 * so this is enough to drive every payload-backed page on tom.so.
 */
const payloadResponse = (docs: PayloadDoc[], page: number, limit: number) => {
  const totalDocs = docs.length;
  const totalPages = limit > 0 ? Math.ceil(totalDocs / limit) : 1;
  return {
    docs: docs.slice((page - 1) * limit, page * limit),
    totalDocs,
    limit,
    page,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

// Payload uses `where[slug][equals]` in query strings; Elysia keeps the
// bracket key literal, so the schema property mirrors it exactly.
const collectionQuery = Schema.toStandardSchemaV1(
  Schema.Struct({
    page: Schema.optional(Schema.NumberFromString),
    limit: Schema.optional(Schema.NumberFromString),
    sort: Schema.optional(Schema.String),
    depth: Schema.optional(Schema.NumberFromString),
    "where[slug][equals]": Schema.optional(Schema.String),
  }),
);

const sortDocs = <T extends PayloadDoc>(docs: T[], sort: string | undefined): T[] => {
  if (sort === "-publishedAt") {
    return [...docs].sort(
      (a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""),
    );
  }
  if (sort === "-updatedAt") {
    return [...docs].sort((a, b) => Date.parse(b.updatedAt ?? "") - Date.parse(a.updatedAt ?? ""));
  }
  return [...docs].sort((a, b) => a.title.localeCompare(b.title));
};

export const payloadSimulator = new Elysia({ name: "payload-simulator" })
  .get(
    "/api/posts",
    ({ query, set }) => {
      const slug = query["where[slug][equals]"];
      const page = query.page ?? 1;
      const limit = query.limit ?? 100;

      if (slug) {
        const post = posts.find((p) => p.slug === slug);
        if (!post) {
          set.status = 404;
          return payloadResponse([], 1, 1);
        }
        return payloadResponse([post], 1, 1);
      }

      return payloadResponse(sortDocs(posts, query.sort), page, limit);
    },
    {
      query: collectionQuery,
      detail: { description: "Simulated Payload posts collection", tags: ["payload"] },
    },
  )
  .get(
    "/api/works",
    ({ query, set }) => {
      const slug = query["where[slug][equals]"];
      const page = query.page ?? 1;
      const limit = query.limit ?? 100;

      if (slug) {
        const work = works.find((w) => w.slug === slug);
        if (!work) {
          set.status = 404;
          return payloadResponse([], 1, 1);
        }
        return payloadResponse([work], 1, 1);
      }

      return payloadResponse(sortDocs(works, query.sort), page, limit);
    },
    {
      query: collectionQuery,
      detail: { description: "Simulated Payload works collection", tags: ["payload"] },
    },
  );

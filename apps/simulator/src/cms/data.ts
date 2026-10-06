import { Schema } from "effect";
import {
  CmsPagingSchema,
  CmsPostSchema,
  CmsPostSummarySchema,
  CmsWorkSchema,
  CmsWorkSummarySchema,
} from "@tom/schemas/cms";
import type { CmsPost, CmsWork } from "@tom/schemas/cms";
import postFixtures from "../../fixtures/cms-posts.json" with { type: "json" };
import workFixtures from "../../fixtures/cms-works.json" with { type: "json" };

/**
 * Fixture data simulates API responses. The JSON stays dumb data; the
 * shapes come from the real CMS schemas via decode (a direct `as` cast
 * cannot bridge JSON literals to branded schema types) — never redeclared
 * here. A drifting fixture fails at boot instead of rendering nonsense.
 */
export const posts = Schema.decodeUnknownSync(Schema.Array(CmsPostSchema))(postFixtures);
export const works = Schema.decodeUnknownSync(Schema.Array(CmsWorkSchema))(workFixtures);

/**
 * Slim list items, mirroring the real summary endpoints: the same fixtures
 * decoded through the summary schemas, so the body never leaves the
 * simulator and shape drift fails at boot.
 */
export const postSummaries = Schema.decodeSync(Schema.Array(CmsPostSummarySchema))(posts);
export const workSummaries = Schema.decodeSync(Schema.Array(CmsWorkSummarySchema))(works);

export type CmsDoc = CmsPost | CmsWork;

type ListableDoc = {
  readonly status: string;
  readonly title: string;
  readonly publishedAt: string | null;
};

export const byPublishedDesc = (a: ListableDoc, b: ListableDoc): number =>
  (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");

export const byTitleAsc = (a: ListableDoc, b: ListableDoc): number =>
  a.title.localeCompare(b.title, undefined, { sensitivity: "base" });

/**
 * Minimal CMS list shape ({ docs, totalDocs, ... }). Serves published docs
 * only — posts newest first, works alphabetical — the same contract as the
 * real API (apps/api). Filter params are accepted and ignored: the fixture
 * store holds published docs only, so there is nothing to scope.
 */
export const listResponse = (
  docs: ReadonlyArray<ListableDoc>,
  page: number,
  limit: number,
  sort: (a: ListableDoc, b: ListableDoc) => number,
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

export const findPublished = (docs: ReadonlyArray<CmsDoc>, slug: string): CmsDoc | undefined =>
  [...docs].sort(byPublishedDesc).find((doc) => doc.slug === slug && doc.status === "published");

export const listQuery = Schema.toStandardSchemaV1(
  Schema.Struct({
    ...CmsPagingSchema.fields,
    limit: Schema.optional(Schema.FiniteFromString),
  }),
);

export const slugParams = Schema.toStandardSchemaV1(Schema.Struct({ slug: Schema.String }));

export const idParams = Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String }));

export const single = (doc: CmsDoc | undefined, set: { status?: number | string }) => {
  if (!doc) {
    set.status = 404;
    return { error: "Not found" };
  }
  return doc;
};

/** 1x1 red PNG: media file bytes for e2e image assertions. */
export const RedPixelPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

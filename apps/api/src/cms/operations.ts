import { Effect } from "effect";
import type {
  CmsListResponse,
  CmsPaging,
  CmsRevisionEntity,
  CmsStatusFilter,
} from "@tom/schemas/cms";
import { CmsError } from "@tom/types/errors";
import { DEFAULT_PAGE_SIZE } from "@tom/schemas/cms";
import { HttpStatus } from "@tom/constants/http";
import type { CmsD1Binding, CmsR2Binding } from "@tom/utils/config";
import {
  MEDIA_COLUMNS,
  POST_COLUMNS,
  POST_SUMMARY_COLUMNS,
  MediaRowSchema,
  type PostRowSchema,
  type PostSummaryRowSchema,
  RevisionRowSchema,
  categoriesForPosts,
  decodeCms,
  findRevisionTarget,
  findRevisionRow,
  mediaUsage,
  parseSnapshot,
  queryAll,
  queryFirst,
  requireMediaRow,
  toMedia,
  toPost,
  toPostSummary,
  toRevisionMeta,
  toWork,
  toWorkSummary,
} from "./records";
import { CmsCategorySchema } from "@tom/schemas/cms";

/**
 * CMS reads. Every function takes the bound D1 handle, so the route layer owns
 * auth and storage resolution and this module only queries.
 */

const toListResponse = <T>(
  docs: ReadonlyArray<T>,
  total: number,
  page: number,
  limit: number,
): CmsListResponse<T> => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    docs,
    totalDocs: total,
    limit,
    page,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

/**
 * The SQL window for a validated paging request. The bounds live in
 * `CmsPagingSchema`, so a decoded `page`/`pageSize` is already in range and
 * this is arithmetic: nothing to clamp, nothing to fail on.
 */
const toPageWindow = (paging: CmsPaging) => {
  const limit = paging.pageSize ?? DEFAULT_PAGE_SIZE;
  const current = paging.page ?? 1;
  return { limit, current, offset: (current - 1) * limit };
};

/**
 * Category scoping for post lists, shared by full and summary selects so
 * the two cannot diverge. `category` keeps only linked posts;
 * `excludeCategory` drops one category (Sophie hides its reserved pages
 * without skewing totals, which a client-side filter would).
 */
const postListFilters = (paging: CmsPaging) => {
  const category = paging.category ?? null;
  const excluded = paging.excludeCategory ?? null;
  const includeFilter =
    category === null
      ? ""
      : "AND EXISTS (SELECT 1 FROM post_categories pc " +
        "JOIN categories c ON c.id = pc.category_id " +
        "WHERE pc.post_id = p.id AND c.slug = ?) ";
  const includeCountFilter =
    category === null
      ? ""
      : " AND EXISTS (SELECT 1 FROM post_categories pc " +
        "JOIN categories c ON c.id = pc.category_id " +
        "WHERE pc.post_id = posts.id AND c.slug = ?)";
  const excludeFilter =
    excluded === null
      ? ""
      : "AND NOT EXISTS (SELECT 1 FROM post_categories pc " +
        "JOIN categories c ON c.id = pc.category_id " +
        "WHERE pc.post_id = p.id AND c.slug = ?) ";
  const excludeCountFilter =
    excluded === null
      ? ""
      : " AND NOT EXISTS (SELECT 1 FROM post_categories pc " +
        "JOIN categories c ON c.id = pc.category_id " +
        "WHERE pc.post_id = posts.id AND c.slug = ?)";
  return {
    rowFilter: includeFilter + excludeFilter,
    countFilter: includeCountFilter + excludeCountFilter,
    params: [...(category === null ? [] : [category]), ...(excluded === null ? [] : [excluded])],
  };
};

export const listPosts = Effect.fn("CmsService.listPosts")(function* (
  db: CmsD1Binding,
  paging: CmsPaging,
  status: CmsStatusFilter,
) {
  const { limit, current, offset } = toPageWindow(paging);
  const { rowFilter, countFilter, params } = postListFilters(paging);
  const [rows, countRow] = yield* Effect.all(
    [
      queryAll<typeof PostRowSchema.Encoded>(
        db,
        `SELECT ${POST_COLUMNS} FROM posts p WHERE (? = 'all' OR p.status = ?) ` +
          rowFilter +
          "ORDER BY p.published_at DESC LIMIT ? OFFSET ?",
        [status, status, ...params, limit, offset],
        "list_posts",
      ),
      queryFirst<{ readonly total: number }>(
        db,
        "SELECT COUNT(*) AS total FROM posts WHERE (? = 'all' OR status = ?)" + countFilter,
        [status, status, ...params],
        "count_posts",
      ),
    ],
    { concurrency: "unbounded" },
  );
  const total = countRow?.total ?? 0;
  const grouped = yield* categoriesForPosts(
    db,
    rows.map((row) => row.id),
    "list_posts",
  );
  const docs = yield* Effect.forEach(rows, (row) => toPost(row, grouped[row.id] ?? []));
  return toListResponse(docs, total, current, limit);
});

/**
 * Slim post list for indexes and sitemaps: selects no body columns and
 * skips the Tiptap parse, so list payloads stay small. Full reads (single
 * post, feed, editor) keep listPosts.
 */
export const listPostSummaries = Effect.fn("CmsService.listPostSummaries")(function* (
  db: CmsD1Binding,
  paging: CmsPaging,
  status: CmsStatusFilter,
) {
  const { limit, current, offset } = toPageWindow(paging);
  const { rowFilter, countFilter, params } = postListFilters(paging);
  const [rows, countRow] = yield* Effect.all(
    [
      queryAll<typeof PostSummaryRowSchema.Encoded>(
        db,
        `SELECT ${POST_SUMMARY_COLUMNS} FROM posts p WHERE (? = 'all' OR p.status = ?) ` +
          rowFilter +
          "ORDER BY p.published_at DESC LIMIT ? OFFSET ?",
        [status, status, ...params, limit, offset],
        "list_post_summaries",
      ),
      queryFirst<{ readonly total: number }>(
        db,
        "SELECT COUNT(*) AS total FROM posts WHERE (? = 'all' OR status = ?)" + countFilter,
        [status, status, ...params],
        "count_post_summaries",
      ),
    ],
    { concurrency: "unbounded" },
  );
  const total = countRow?.total ?? 0;
  const grouped = yield* categoriesForPosts(
    db,
    rows.map((row) => row.id),
    "list_post_summaries",
  );
  const docs = yield* Effect.forEach(rows, (row) => toPostSummary(row, grouped[row.id] ?? []));
  return toListResponse(docs, total, current, limit);
});

export const getPostBySlug = Effect.fn("CmsService.getPostBySlug")(function* (
  db: CmsD1Binding,
  slug: string,
  status: CmsStatusFilter,
) {
  const row = yield* queryFirst<typeof PostRowSchema.Encoded>(
    db,
    `SELECT ${POST_COLUMNS} FROM posts p WHERE p.slug = ? AND (? = 'all' OR p.status = ?) LIMIT 1`,
    [slug, status, status],
    "get_post",
  );
  if (!row) {
    return yield* new CmsError({
      message: `Post not found: ${slug}`,
      status: HttpStatus.NotFound,
      operation: "get_post",
    });
  }
  const grouped = yield* categoriesForPosts(db, [row.id], "get_post");
  return yield* toPost(row, grouped[row.id] ?? []);
});

export const listWorks = Effect.fn("CmsService.listWorks")(function* (
  db: CmsD1Binding,
  paging: CmsPaging,
  status: CmsStatusFilter,
) {
  const { limit, current, offset } = toPageWindow(paging);
  const [rows, countRow] = yield* Effect.all(
    [
      queryAll<typeof PostRowSchema.Encoded>(
        db,
        `SELECT ${POST_COLUMNS} FROM works p WHERE (? = 'all' OR p.status = ?) ` +
          "ORDER BY p.title COLLATE NOCASE ASC LIMIT ? OFFSET ?",
        [status, status, limit, offset],
        "list_works",
      ),
      queryFirst<{ readonly total: number }>(
        db,
        "SELECT COUNT(*) AS total FROM works WHERE (? = 'all' OR status = ?)",
        [status, status],
        "count_works",
      ),
    ],
    { concurrency: "unbounded" },
  );
  const total = countRow?.total ?? 0;
  const docs = yield* Effect.forEach(rows, (row) => toWork(row));
  return toListResponse(docs, total, current, limit);
});

/**
 * Slim work list for indexes and sitemaps: no body columns, no Tiptap
 * parse. Full reads (single work, editor) keep listWorks.
 */
export const listWorkSummaries = Effect.fn("CmsService.listWorkSummaries")(function* (
  db: CmsD1Binding,
  paging: CmsPaging,
  status: CmsStatusFilter,
) {
  const { limit, current, offset } = toPageWindow(paging);
  const [rows, countRow] = yield* Effect.all(
    [
      queryAll<typeof PostSummaryRowSchema.Encoded>(
        db,
        `SELECT ${POST_SUMMARY_COLUMNS} FROM works p WHERE (? = 'all' OR p.status = ?) ` +
          "ORDER BY p.title COLLATE NOCASE ASC LIMIT ? OFFSET ?",
        [status, status, limit, offset],
        "list_work_summaries",
      ),
      queryFirst<{ readonly total: number }>(
        db,
        "SELECT COUNT(*) AS total FROM works WHERE (? = 'all' OR status = ?)",
        [status, status],
        "count_work_summaries",
      ),
    ],
    { concurrency: "unbounded" },
  );
  const total = countRow?.total ?? 0;
  const docs = yield* Effect.forEach(rows, (row) => toWorkSummary(row));
  return toListResponse(docs, total, current, limit);
});

export const getWorkBySlug = Effect.fn("CmsService.getWorkBySlug")(function* (
  db: CmsD1Binding,
  slug: string,
  status: CmsStatusFilter,
) {
  const row = yield* queryFirst<typeof PostRowSchema.Encoded>(
    db,
    `SELECT ${POST_COLUMNS} FROM works p WHERE p.slug = ? AND (? = 'all' OR p.status = ?) LIMIT 1`,
    [slug, status, status],
    "get_work",
  );
  if (!row) {
    return yield* new CmsError({
      message: `Work not found: ${slug}`,
      status: HttpStatus.NotFound,
      operation: "get_work",
    });
  }
  return yield* toWork(row);
});

export const listCategories = Effect.fn("CmsService.listCategories")(function* (db: CmsD1Binding) {
  const rows = yield* queryAll<typeof CmsCategorySchema.Encoded>(
    db,
    "SELECT id, slug, title FROM categories ORDER BY title ASC",
    [],
    "list_categories",
  );
  return yield* Effect.forEach(rows, (row) =>
    decodeCms(CmsCategorySchema, row, "Invalid CMS category row", "list_categories"),
  );
});

export const getMediaById = Effect.fn("CmsService.getMediaById")(function* (
  db: CmsD1Binding,
  id: string,
) {
  return yield* toMedia(yield* requireMediaRow(db, id, "get_media"));
});

export const listMedia = Effect.fn("CmsService.listMedia")(function* (
  db: CmsD1Binding,
  paging: CmsPaging,
) {
  const { limit, current, offset } = toPageWindow(paging);
  const [rows, countRow] = yield* Effect.all(
    [
      queryAll<typeof MediaRowSchema.Encoded>(
        db,
        `SELECT ${MEDIA_COLUMNS} FROM media ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?`,
        [limit, offset],
        "list_media",
      ),
      queryFirst<{ readonly total: number }>(
        db,
        "SELECT COUNT(*) AS total FROM media",
        [],
        "count_media",
      ),
    ],
    { concurrency: "unbounded" },
  );
  const total = countRow?.total ?? 0;
  const docs = yield* Effect.forEach(rows, (row) => toMedia(row));
  return toListResponse(docs, total, current, limit);
});

export const getMediaUsage = Effect.fn("CmsService.getMediaUsage")(function* (
  db: CmsD1Binding,
  id: string,
) {
  const [, usage] = yield* Effect.all(
    [requireMediaRow(db, id, "get_media_usage"), mediaUsage(db, id, "get_media_usage")],
    { concurrency: "unbounded" },
  );
  return usage;
});

export const listRevisions = Effect.fn("CmsService.listRevisions")(function* (
  db: CmsD1Binding,
  entity: CmsRevisionEntity,
  slug: string,
) {
  const target = yield* findRevisionTarget(db, entity, slug, "list_revisions");
  const rows = yield* queryAll<typeof RevisionRowSchema.Encoded>(
    db,
    "SELECT id, snapshot_json, actor, created_at FROM revisions " +
      "WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC, rowid DESC",
    [entity, target.id],
    "list_revisions",
  );
  return yield* Effect.forEach(rows, (row) => toRevisionMeta(row, entity, "list_revisions"));
});

export const getRevision = Effect.fn("CmsService.getRevision")(function* (
  db: CmsD1Binding,
  entity: CmsRevisionEntity,
  slug: string,
  revisionId: string,
) {
  const target = yield* findRevisionTarget(db, entity, slug, "get_revision");
  const row = yield* findRevisionRow(db, entity, target.id, revisionId, "get_revision");
  return yield* parseSnapshot(row.snapshot_json, entity, "get_revision");
});

/** Load a media object's bytes for public file serving. */
export const getMediaFile = Effect.fn("CmsService.getMediaFile")(function* (
  db: CmsD1Binding,
  r2: CmsR2Binding,
  id: string,
) {
  const row = yield* requireMediaRow(db, id, "get_media_file");
  const object = yield* Effect.tryPromise({
    try: () => r2.get(row.key),
    catch: (cause) =>
      new CmsError({
        message: "Media read failed",
        status: HttpStatus.InternalServerError,
        operation: "get_media_file",
        cause,
      }),
  });
  if (!object) {
    return yield* new CmsError({
      message: `Media file missing: ${id}`,
      status: HttpStatus.NotFound,
      operation: "get_media_file",
    });
  }
  return { mime: row.mime, object };
});

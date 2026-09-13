import { Effect, Schema } from "effect";
import {
  CmsMediaVariantSchema,
  TiptapDocSchema,
  CmsCategorySchema,
  CmsMediaSchema,
  CmsMediaUsageRefSchema,
  CmsPostInputSchema,
  CmsPostSchema,
  CmsPostSummarySchema,
  CmsRevisionMetaSchema,
  CmsWorkInputSchema,
  CmsWorkSchema,
  CmsWorkSummarySchema,
} from "@tom/schemas/cms";
import type {
  CmsCategory,
  CmsCategoryInput,
  CmsListResponse,
  CmsMediaId,
  CmsPaging,
  CmsPostInput,
  CmsRevisionEntity,
  CmsRevisionSnapshot,
  CmsStatusFilter,
  CmsWorkInput,
  TiptapDoc,
} from "@tom/schemas/cms";
import { CmsError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import type { CmsD1Binding, CmsR2Binding } from "@tom/utils/services/config";
import { renderTiptapHtml } from "@tom/utils/tiptap-html";

type PostRow = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string | null;
  readonly content_json: string;
  readonly html: string;
  readonly status: string;
  readonly published_at: string | null;
  readonly hero_media_id: string | null;
  readonly meta_title: string | null;
  readonly meta_description: string | null;
  readonly meta_image: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

type WorkRow = PostRow;

type PostSummaryRow = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string | null;
  readonly status: string;
  readonly published_at: string | null;
  readonly hero_media_id: string | null;
  readonly meta_title: string | null;
  readonly meta_description: string | null;
  readonly meta_image: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

type WorkSummaryRow = PostSummaryRow;

type MediaRow = {
  readonly id: string;
  readonly key: string;
  readonly mime: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly alt: string | null;
  readonly caption: string | null;
  readonly variants_json: string;
  readonly created_at: string;
  readonly updated_at: string;
};

type CategoryLinkRow = {
  readonly postId: string;
  readonly id: string;
  readonly slug: string;
  readonly title: string;
};

type RevisionRow = {
  readonly id: string;
  readonly snapshot_json: string;
  readonly actor: string | null;
  readonly created_at: string;
};

/** Revisions kept per document; older snapshots prune on write. */
const MAX_REVISIONS = 20;

const POST_COLUMN_LIST = [
  "p.id",
  "p.slug",
  "p.title",
  "p.summary",
  "p.content_json",
  "p.html",
  "p.status",
  "p.published_at",
  "p.hero_media_id",
  "p.meta_title",
  "p.meta_description",
  "p.meta_image",
  "p.created_at",
  "p.updated_at",
];

const POST_COLUMNS = POST_COLUMN_LIST.join(", ");

/**
 * List columns: everything except the heavy body (content_json, html).
 * Derived from POST_COLUMNS so a new column cannot silently miss the
 * summary selects (a missing column 500s the summary decode instead).
 */
const POST_SUMMARY_COLUMNS = POST_COLUMN_LIST.filter(
  (column) => column !== "p.content_json" && column !== "p.html",
).join(", ");

/** Slugs shadowed by static API routes; single reads for them are unreachable. */
const RESERVED_SLUGS = ["summary"];

const rejectReservedSlug = (slug: string, operation: string): Effect.Effect<void, CmsError> =>
  RESERVED_SLUGS.includes(slug)
    ? Effect.fail(
        new CmsError({
          message: `Slug reserved: ${slug}`,
          status: HttpStatus.BadRequest,
          operation,
        }),
      )
    : Effect.void;

const queryAll = <T>(
  db: CmsD1Binding,
  sql: string,
  params: ReadonlyArray<string | number | null>,
  operation: string,
): Effect.Effect<ReadonlyArray<T>, CmsError> =>
  Effect.tryPromise({
    try: () =>
      db
        .prepare(sql)
        .bind(...params)
        .all<T>(),
    catch: (cause) =>
      new CmsError({
        message: "CMS query failed",
        status: HttpStatus.InternalServerError,
        operation,
        cause,
      }),
  }).pipe(Effect.map((result) => result.results));

const queryFirst = <T>(
  db: CmsD1Binding,
  sql: string,
  params: ReadonlyArray<string | number | null>,
  operation: string,
): Effect.Effect<T | null, CmsError> =>
  Effect.tryPromise({
    try: () =>
      db
        .prepare(sql)
        .bind(...params)
        .first<T>(),
    catch: (cause) =>
      new CmsError({
        message: "CMS query failed",
        status: HttpStatus.InternalServerError,
        operation,
        cause,
      }),
  });

const parseContentJson = (json: string, operation: string): Effect.Effect<TiptapDoc, CmsError> =>
  Schema.decodeUnknownEffect(Schema.fromJsonString(TiptapDocSchema))(json).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message: "Invalid CMS content JSON",
          status: HttpStatus.InternalServerError,
          operation,
          cause,
        }),
    ),
  );

/** Fields shared by full and summary rows: everything except the body. */
const baseFields = (row: PostSummaryRow) => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  summary: row.summary,
  status: row.status,
  publishedAt: row.published_at,
  heroMediaId: row.hero_media_id,
  meta: {
    title: row.meta_title,
    description: row.meta_description,
    image: row.meta_image,
  },
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toPost = Effect.fn("CmsService.toPost")(function* (
  row: PostRow,
  categories: ReadonlyArray<CmsCategory>,
) {
  const content = yield* parseContentJson(row.content_json, "decode_post");
  return yield* Schema.decodeUnknownEffect(CmsPostSchema)({
    ...baseFields(row),
    content,
    html: row.html,
    categories,
  }).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message: "Invalid CMS post row",
          status: HttpStatus.InternalServerError,
          operation: "decode_post",
          cause,
        }),
    ),
  );
});

const toWork = Effect.fn("CmsService.toWork")(function* (row: WorkRow) {
  const content = yield* parseContentJson(row.content_json, "decode_work");
  return yield* Schema.decodeUnknownEffect(CmsWorkSchema)({
    ...baseFields(row),
    content,
    html: row.html,
  }).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message: "Invalid CMS work row",
          status: HttpStatus.InternalServerError,
          operation: "decode_work",
          cause,
        }),
    ),
  );
});

/** Slim post row: no Tiptap parse, no HTML — the body never leaves D1. */
const toPostSummary = Effect.fn("CmsService.toPostSummary")(function* (
  row: PostSummaryRow,
  categories: ReadonlyArray<CmsCategory>,
) {
  return yield* Schema.decodeUnknownEffect(CmsPostSummarySchema)({
    ...baseFields(row),
    categories,
  }).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message: "Invalid CMS post row",
          status: HttpStatus.InternalServerError,
          operation: "decode_post_summary",
          cause,
        }),
    ),
  );
});

/** Slim work row: no Tiptap parse, no HTML. */
const toWorkSummary = Effect.fn("CmsService.toWorkSummary")(function* (row: WorkSummaryRow) {
  return yield* Schema.decodeUnknownEffect(CmsWorkSummarySchema)({
    ...baseFields(row),
  }).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message: "Invalid CMS work row",
          status: HttpStatus.InternalServerError,
          operation: "decode_work_summary",
          cause,
        }),
    ),
  );
});

const toMedia = Effect.fn("CmsService.toMedia")(function* (row: MediaRow) {
  const variants = yield* Schema.decodeUnknownEffect(
    Schema.fromJsonString(Schema.Array(CmsMediaVariantSchema)),
  )(row.variants_json).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message: "Invalid CMS media row",
          status: HttpStatus.InternalServerError,
          operation: "decode_media",
          cause,
        }),
    ),
  );
  return yield* Schema.decodeUnknownEffect(CmsMediaSchema)({
    id: row.id,
    key: row.key,
    mime: row.mime,
    width: row.width,
    height: row.height,
    alt: row.alt,
    caption: row.caption,
    variants,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message: "Invalid CMS media row",
          status: HttpStatus.InternalServerError,
          operation: "decode_media",
          cause,
        }),
    ),
  );
});

const categoriesForPosts = Effect.fn("CmsService.categoriesForPosts")(function* (
  db: CmsD1Binding,
  postIds: ReadonlyArray<string>,
  operation: string,
) {
  const grouped: Record<string, Array<CmsCategory>> = {};
  if (postIds.length === 0) return grouped;
  const placeholders = postIds.map(() => "?").join(",");
  const rows = yield* queryAll<CategoryLinkRow>(
    db,
    "SELECT pc.post_id AS postId, c.id, c.slug, c.title FROM post_categories pc " +
      "JOIN categories c ON c.id = pc.category_id " +
      `WHERE pc.post_id IN (${placeholders})`,
    postIds,
    operation,
  );
  for (const row of rows) {
    const category = yield* Schema.decodeUnknownEffect(CmsCategorySchema)({
      id: row.id,
      slug: row.slug,
      title: row.title,
    }).pipe(
      Effect.mapError(
        (cause) =>
          new CmsError({
            message: "Invalid CMS category row",
            status: HttpStatus.InternalServerError,
            operation,
            cause,
          }),
      ),
    );
    const existing = grouped[row.postId] ?? [];
    grouped[row.postId] = [...existing, category];
  }
  return grouped;
});

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

const normalizePaging = (
  paging: CmsPaging,
  operation: string,
): Effect.Effect<{ limit: number; current: number; offset: number }, CmsError> => {
  const limit = Math.min(Math.max(paging.pageSize ?? 10, 1), 100);
  const current = Math.max(paging.page ?? 1, 1);
  // NumberFromString coerces unparseable input to NaN instead of failing,
  // so reject non-integers here before they reach SQL.
  if (!Number.isInteger(limit) || !Number.isInteger(current)) {
    return Effect.fail(
      new CmsError({
        message: "Invalid paging parameters",
        status: HttpStatus.BadRequest,
        operation,
      }),
    );
  }
  return Effect.succeed({ limit, current, offset: (current - 1) * limit });
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
  const { limit, current, offset } = yield* normalizePaging(paging, "list_posts");
  const { rowFilter, countFilter, params } = postListFilters(paging);
  const [rows, countRow] = yield* Effect.all([
    queryAll<PostRow>(
      db,
      `SELECT ${POST_COLUMNS} FROM posts p WHERE (? = 'all' OR p.status = ?) ` +
        rowFilter +
        "ORDER BY p.published_at DESC LIMIT ? OFFSET ?",
      [status, status, ...params, limit, offset],
      "list_posts",
    ),
    queryFirst<{ total: number }>(
      db,
      "SELECT COUNT(*) AS total FROM posts WHERE (? = 'all' OR status = ?)" + countFilter,
      [status, status, ...params],
      "count_posts",
    ),
  ]);
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
  const { limit, current, offset } = yield* normalizePaging(paging, "list_post_summaries");
  const { rowFilter, countFilter, params } = postListFilters(paging);
  const [rows, countRow] = yield* Effect.all([
    queryAll<PostSummaryRow>(
      db,
      `SELECT ${POST_SUMMARY_COLUMNS} FROM posts p WHERE (? = 'all' OR p.status = ?) ` +
        rowFilter +
        "ORDER BY p.published_at DESC LIMIT ? OFFSET ?",
      [status, status, ...params, limit, offset],
      "list_post_summaries",
    ),
    queryFirst<{ total: number }>(
      db,
      "SELECT COUNT(*) AS total FROM posts WHERE (? = 'all' OR status = ?)" + countFilter,
      [status, status, ...params],
      "count_post_summaries",
    ),
  ]);
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
  const row = yield* queryFirst<PostRow>(
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
  const { limit, current, offset } = yield* normalizePaging(paging, "list_works");
  const [rows, countRow] = yield* Effect.all([
    queryAll<WorkRow>(
      db,
      `SELECT ${POST_COLUMNS} FROM works p WHERE (? = 'all' OR p.status = ?) ` +
        "ORDER BY p.title COLLATE NOCASE ASC LIMIT ? OFFSET ?",
      [status, status, limit, offset],
      "list_works",
    ),
    queryFirst<{ total: number }>(
      db,
      "SELECT COUNT(*) AS total FROM works WHERE (? = 'all' OR status = ?)",
      [status, status],
      "count_works",
    ),
  ]);
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
  const { limit, current, offset } = yield* normalizePaging(paging, "list_work_summaries");
  const [rows, countRow] = yield* Effect.all([
    queryAll<WorkSummaryRow>(
      db,
      `SELECT ${POST_SUMMARY_COLUMNS} FROM works p WHERE (? = 'all' OR p.status = ?) ` +
        "ORDER BY p.title COLLATE NOCASE ASC LIMIT ? OFFSET ?",
      [status, status, limit, offset],
      "list_work_summaries",
    ),
    queryFirst<{ total: number }>(
      db,
      "SELECT COUNT(*) AS total FROM works WHERE (? = 'all' OR status = ?)",
      [status, status],
      "count_work_summaries",
    ),
  ]);
  const total = countRow?.total ?? 0;
  const docs = yield* Effect.forEach(rows, (row) => toWorkSummary(row));
  return toListResponse(docs, total, current, limit);
});

export const getWorkBySlug = Effect.fn("CmsService.getWorkBySlug")(function* (
  db: CmsD1Binding,
  slug: string,
  status: CmsStatusFilter,
) {
  const row = yield* queryFirst<WorkRow>(
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
  const rows = yield* queryAll<{ id: string; slug: string; title: string }>(
    db,
    "SELECT id, slug, title FROM categories ORDER BY title ASC",
    [],
    "list_categories",
  );
  return yield* Effect.forEach(rows, (row) =>
    Schema.decodeUnknownEffect(CmsCategorySchema)(row).pipe(
      Effect.mapError(
        (cause) =>
          new CmsError({
            message: "Invalid CMS category row",
            status: HttpStatus.InternalServerError,
            operation: "list_categories",
            cause,
          }),
      ),
    ),
  );
});

const MEDIA_COLUMNS =
  "id, key, mime, width, height, alt, caption, variants_json, created_at, updated_at";

/** Load a media row by id, failing the operation with 404 when absent. */
const requireMediaRow = Effect.fn("CmsService.requireMediaRow")(function* (
  db: CmsD1Binding,
  id: string,
  operation: string,
) {
  const row = yield* queryFirst<MediaRow>(
    db,
    `SELECT ${MEDIA_COLUMNS} FROM media WHERE id = ? LIMIT 1`,
    [id],
    operation,
  );
  if (!row) {
    return yield* new CmsError({
      message: `Media not found: ${id}`,
      status: HttpStatus.NotFound,
      operation,
    });
  }
  return row;
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
  const { limit, current, offset } = yield* normalizePaging(paging, "list_media");
  const [rows, countRow] = yield* Effect.all([
    queryAll<MediaRow>(
      db,
      `SELECT ${MEDIA_COLUMNS} FROM media ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?`,
      [limit, offset],
      "list_media",
    ),
    queryFirst<{ total: number }>(db, "SELECT COUNT(*) AS total FROM media", [], "count_media"),
  ]);
  const total = countRow?.total ?? 0;
  const docs = yield* Effect.forEach(rows, (row) => toMedia(row));
  return toListResponse(docs, total, current, limit);
});

type UsageRefRow = {
  readonly slug: string;
  readonly title: string;
};

const usageRefs = Effect.fn("CmsService.usageRefs")(function* (
  db: CmsD1Binding,
  table: "posts" | "works",
  id: string,
  operation: string,
) {
  const rows = yield* queryAll<UsageRefRow>(
    db,
    // Match the bare id: stored JSON spacing varies (compact or spaced),
    // and a UUID never appears in prose by accident.
    `SELECT slug, title FROM ${table} WHERE hero_media_id = ? OR instr(content_json, ?) > 0 ` +
      "ORDER BY title COLLATE NOCASE ASC",
    [id, id],
    operation,
  );
  return yield* Effect.forEach(rows, (row) =>
    Schema.decodeUnknownEffect(CmsMediaUsageRefSchema)(row).pipe(
      Effect.mapError(
        (cause) =>
          new CmsError({
            message: "Invalid CMS usage row",
            status: HttpStatus.InternalServerError,
            operation,
            cause,
          }),
      ),
    ),
  );
});

export const getMediaUsage = Effect.fn("CmsService.getMediaUsage")(function* (
  db: CmsD1Binding,
  id: string,
) {
  yield* requireMediaRow(db, id, "get_media_usage");
  const [posts, works] = yield* Effect.all([
    usageRefs(db, "posts", id, "get_media_usage"),
    usageRefs(db, "works", id, "get_media_usage"),
  ]);
  return { posts, works };
});

export type MediaUpload = {
  readonly name: string;
  readonly mime: string;
  readonly bytes: ArrayBuffer;
  readonly alt: string | null;
  readonly caption: string | null;
};

const runStatement = (
  db: CmsD1Binding,
  sql: string,
  params: ReadonlyArray<string | number | null>,
  operation: string,
): Effect.Effect<void, CmsError> =>
  Effect.tryPromise({
    try: () =>
      db
        .prepare(sql)
        .bind(...params)
        .run(),
    catch: (cause) =>
      new CmsError({
        message: "CMS write failed",
        status: HttpStatus.InternalServerError,
        operation,
        cause,
      }),
  }).pipe(Effect.asVoid);

const findRowBySlug = <T>(
  db: CmsD1Binding,
  table: "posts" | "works" | "categories",
  slug: string,
  operation: string,
): Effect.Effect<T | null, CmsError> =>
  queryFirst<T>(
    db,
    table === "categories"
      ? "SELECT id, slug, title FROM categories WHERE slug = ? LIMIT 1"
      : `SELECT ${POST_COLUMNS} FROM ${table} p WHERE p.slug = ? LIMIT 1`,
    [slug],
    operation,
  );

const readPostById = Effect.fn("CmsService.readPostById")(function* (
  db: CmsD1Binding,
  id: string,
  operation: string,
) {
  const row = yield* queryFirst<PostRow>(
    db,
    `SELECT ${POST_COLUMNS} FROM posts p WHERE p.id = ? LIMIT 1`,
    [id],
    operation,
  );
  if (!row) {
    return yield* new CmsError({
      message: "Post not found",
      status: HttpStatus.NotFound,
      operation,
    });
  }
  const grouped = yield* categoriesForPosts(db, [row.id], operation);
  return yield* toPost(row, grouped[row.id] ?? []);
});

const readWorkById = Effect.fn("CmsService.readWorkById")(function* (
  db: CmsD1Binding,
  id: string,
  operation: string,
) {
  const row = yield* queryFirst<WorkRow>(
    db,
    `SELECT ${POST_COLUMNS} FROM works p WHERE p.id = ? LIMIT 1`,
    [id],
    operation,
  );
  if (!row) {
    return yield* new CmsError({
      message: "Work not found",
      status: HttpStatus.NotFound,
      operation,
    });
  }
  return yield* toWork(row);
});

/** Replace a post's category links after verifying every id exists. */
const replacePostCategories = Effect.fn("CmsService.replacePostCategories")(function* (
  db: CmsD1Binding,
  postId: string,
  categoryIds: ReadonlyArray<string>,
  operation: string,
) {
  yield* runStatement(db, "DELETE FROM post_categories WHERE post_id = ?", [postId], operation);
  const uniqueIds = [...new Set(categoryIds)];
  if (uniqueIds.length === 0) return;
  const placeholders = uniqueIds.map(() => "?").join(",");
  const known = yield* queryAll<{ id: string }>(
    db,
    `SELECT id FROM categories WHERE id IN (${placeholders})`,
    uniqueIds,
    operation,
  );
  if (known.length !== uniqueIds.length) {
    return yield* new CmsError({
      message: "Unknown category id",
      status: HttpStatus.BadRequest,
      operation,
    });
  }
  yield* Effect.forEach(uniqueIds, (categoryId) =>
    runStatement(
      db,
      "INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)",
      [postId, categoryId],
      operation,
    ),
  );
});

const mediaUrlFor =
  (adapterUrl: string) =>
  (mediaId: CmsMediaId | string): string =>
    `${adapterUrl}/content/media/${mediaId}/file`;

/**
 * Snapshot a write input as a revision, then prune past the cap. The
 * snapshot is exactly what create/update accepts, so a restore replays it
 * through the normal update path (and records its own revision).
 */
const recordRevision = Effect.fn("CmsService.recordRevision")(function* (
  db: CmsD1Binding,
  entity: CmsRevisionEntity,
  entityId: string,
  snapshot: CmsPostInput | CmsWorkInput,
  actor: string,
  operation: string,
) {
  const now = new Date().toISOString();
  yield* runStatement(
    db,
    "INSERT INTO revisions (id, entity_type, entity_id, snapshot_json, actor, created_at) " +
      "VALUES (?, ?, ?, ?, ?, ?)",
    [crypto.randomUUID(), entity, entityId, JSON.stringify(snapshot), actor, now],
    operation,
  );
  yield* runStatement(
    db,
    "DELETE FROM revisions WHERE entity_type = ? AND entity_id = ? AND id NOT IN " +
      "(SELECT id FROM revisions WHERE entity_type = ? AND entity_id = ? " +
      "ORDER BY created_at DESC, rowid DESC LIMIT ?)",
    [entity, entityId, entity, entityId, MAX_REVISIONS],
    operation,
  );
});

const decodeJsonSnapshot = <A, I>(
  schema: Schema.Codec<A, I>,
  json: string,
  operation: string,
): Effect.Effect<A, CmsError> =>
  Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(json).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message: "Invalid revision snapshot",
          status: HttpStatus.InternalServerError,
          operation,
          cause,
        }),
    ),
  );

const parseSnapshot = (
  json: string,
  entity: CmsRevisionEntity,
  operation: string,
): Effect.Effect<CmsRevisionSnapshot, CmsError> =>
  entity === "post"
    ? decodeJsonSnapshot(CmsPostInputSchema, json, operation)
    : decodeJsonSnapshot(CmsWorkInputSchema, json, operation);

const toRevisionMeta = Effect.fn("CmsService.toRevisionMeta")(function* (
  row: RevisionRow,
  entity: CmsRevisionEntity,
  operation: string,
) {
  const snapshot = yield* parseSnapshot(row.snapshot_json, entity, operation);
  return yield* Schema.decodeUnknownEffect(CmsRevisionMetaSchema)({
    id: row.id,
    createdAt: row.created_at,
    actor: row.actor,
    title: snapshot.title,
  }).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message: "Invalid revision row",
          status: HttpStatus.InternalServerError,
          operation,
          cause,
        }),
    ),
  );
});

const revisionTable = (entity: CmsRevisionEntity): "posts" | "works" =>
  entity === "post" ? "posts" : "works";

const findRevisionTarget = Effect.fn("CmsService.findRevisionTarget")(function* (
  db: CmsD1Binding,
  entity: CmsRevisionEntity,
  slug: string,
  operation: string,
) {
  const row = yield* findRowBySlug<PostRow>(db, revisionTable(entity), slug, operation);
  if (!row) {
    return yield* new CmsError({
      message: entity === "post" ? `Post not found: ${slug}` : `Work not found: ${slug}`,
      status: HttpStatus.NotFound,
      operation,
    });
  }
  return row;
});

export const listRevisions = Effect.fn("CmsService.listRevisions")(function* (
  db: CmsD1Binding,
  entity: CmsRevisionEntity,
  slug: string,
) {
  const target = yield* findRevisionTarget(db, entity, slug, "list_revisions");
  const rows = yield* queryAll<RevisionRow>(
    db,
    "SELECT id, snapshot_json, actor, created_at FROM revisions " +
      "WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC, rowid DESC",
    [entity, target.id],
    "list_revisions",
  );
  return yield* Effect.forEach(rows, (row) => toRevisionMeta(row, entity, "list_revisions"));
});

const findRevisionRow = Effect.fn("CmsService.findRevisionRow")(function* (
  db: CmsD1Binding,
  entity: CmsRevisionEntity,
  entityId: string,
  revisionId: string,
  operation: string,
) {
  const row = yield* queryFirst<RevisionRow>(
    db,
    "SELECT id, snapshot_json, actor, created_at FROM revisions " +
      "WHERE entity_type = ? AND entity_id = ? AND id = ? LIMIT 1",
    [entity, entityId, revisionId],
    operation,
  );
  if (!row) {
    return yield* new CmsError({
      message: `Revision not found: ${revisionId}`,
      status: HttpStatus.NotFound,
      operation,
    });
  }
  return row;
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

export const restoreRevision = Effect.fn("CmsService.restoreRevision")(function* (
  db: CmsD1Binding,
  entity: CmsRevisionEntity,
  slug: string,
  revisionId: string,
  actor: string,
  adapterUrl: string,
) {
  const target = yield* findRevisionTarget(db, entity, slug, "restore_revision");
  const row = yield* findRevisionRow(db, entity, target.id, revisionId, "restore_revision");
  if (entity === "post") {
    const snapshot = yield* decodeJsonSnapshot(
      CmsPostInputSchema,
      row.snapshot_json,
      "restore_revision",
    );
    return yield* updatePost(db, slug, snapshot, actor, adapterUrl);
  }
  const snapshot = yield* decodeJsonSnapshot(
    CmsWorkInputSchema,
    row.snapshot_json,
    "restore_revision",
  );
  return yield* updateWork(db, slug, snapshot, actor, adapterUrl);
});

const insertDocRow = (
  db: CmsD1Binding,
  table: "posts" | "works",
  row: PostRow,
  operation: string,
): Effect.Effect<void, CmsError> =>
  runStatement(
    db,
    `INSERT INTO ${table} (id, slug, title, summary, content_json, html, status, ` +
      "published_at, hero_media_id, meta_title, meta_description, meta_image, " +
      "created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      row.id,
      row.slug,
      row.title,
      row.summary,
      row.content_json,
      row.html,
      row.status,
      row.published_at,
      row.hero_media_id,
      row.meta_title,
      row.meta_description,
      row.meta_image,
      row.created_at,
      row.updated_at,
    ],
    operation,
  );

const updateDocRow = (
  db: CmsD1Binding,
  table: "posts" | "works",
  row: PostRow,
  operation: string,
): Effect.Effect<void, CmsError> =>
  runStatement(
    db,
    `UPDATE ${table} SET title = ?, summary = ?, content_json = ?, html = ?, status = ?, ` +
      "published_at = ?, hero_media_id = ?, meta_title = ?, meta_description = ?, " +
      "meta_image = ?, updated_at = ? WHERE id = ?",
    [
      row.title,
      row.summary,
      row.content_json,
      row.html,
      row.status,
      row.published_at,
      row.hero_media_id,
      row.meta_title,
      row.meta_description,
      row.meta_image,
      row.updated_at,
      row.id,
    ],
    operation,
  );

const toPostRow = (
  input: CmsPostInput | CmsWorkInput,
  html: string,
  id: string,
  now: string,
  createdAt: string,
): PostRow => ({
  id,
  slug: input.slug,
  title: input.title,
  summary: input.summary,
  content_json: JSON.stringify(input.content),
  html,
  status: input.status,
  published_at: input.publishedAt,
  hero_media_id: input.heroMediaId,
  meta_title: input.meta.title,
  meta_description: input.meta.description,
  meta_image: input.meta.image,
  created_at: createdAt,
  updated_at: now,
});

export const createPost = Effect.fn("CmsService.createPost")(function* (
  db: CmsD1Binding,
  input: CmsPostInput,
  actor: string,
  adapterUrl: string,
) {
  yield* rejectReservedSlug(input.slug, "create_post");
  const taken = yield* findRowBySlug<PostRow>(db, "posts", input.slug, "create_post");
  if (taken) {
    return yield* new CmsError({
      message: `Post slug taken: ${input.slug}`,
      status: HttpStatus.Conflict,
      operation: "create_post",
    });
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const html = yield* renderTiptapHtml(input.content, mediaUrlFor(adapterUrl));
  yield* insertDocRow(db, "posts", toPostRow(input, html, id, now, now), "create_post");
  yield* replacePostCategories(db, id, input.categoryIds, "create_post");
  yield* recordRevision(db, "post", id, input, actor, "create_post");
  return yield* readPostById(db, id, "create_post");
});

export const updatePost = Effect.fn("CmsService.updatePost")(function* (
  db: CmsD1Binding,
  slug: string,
  input: CmsPostInput,
  actor: string,
  adapterUrl: string,
) {
  yield* rejectReservedSlug(slug, "update_post");
  if (input.slug !== slug) {
    return yield* new CmsError({
      message: "Post slug is immutable",
      status: HttpStatus.BadRequest,
      operation: "update_post",
    });
  }
  const existing = yield* findRowBySlug<PostRow>(db, "posts", slug, "update_post");
  if (!existing) {
    return yield* new CmsError({
      message: `Post not found: ${slug}`,
      status: HttpStatus.NotFound,
      operation: "update_post",
    });
  }
  const now = new Date().toISOString();
  const html = yield* renderTiptapHtml(input.content, mediaUrlFor(adapterUrl));
  const row = toPostRow(input, html, existing.id, now, existing.created_at);
  yield* updateDocRow(db, "posts", row, "update_post");
  yield* replacePostCategories(db, row.id, input.categoryIds, "update_post");
  yield* recordRevision(db, "post", row.id, input, actor, "update_post");
  return yield* readPostById(db, row.id, "update_post");
});

/** Delete a row by slug, failing the operation with 404 when absent. */
const deleteRowBySlug = Effect.fn("CmsService.deleteRowBySlug")(function* (
  db: CmsD1Binding,
  table: "posts" | "works" | "categories",
  label: string,
  slug: string,
  operation: string,
) {
  const existing = yield* findRowBySlug<{ id: string }>(db, table, slug, operation);
  if (!existing) {
    return yield* new CmsError({
      message: `${label} not found: ${slug}`,
      status: HttpStatus.NotFound,
      operation,
    });
  }
  yield* runStatement(db, `DELETE FROM ${table} WHERE id = ?`, [existing.id], operation);
  return { id: existing.id };
});

export const deletePost = Effect.fn("CmsService.deletePost")(function* (
  db: CmsD1Binding,
  slug: string,
) {
  return yield* deleteRowBySlug(db, "posts", "Post", slug, "delete_post");
});

export const createWork = Effect.fn("CmsService.createWork")(function* (
  db: CmsD1Binding,
  input: CmsWorkInput,
  actor: string,
  adapterUrl: string,
) {
  yield* rejectReservedSlug(input.slug, "create_work");
  const taken = yield* findRowBySlug<WorkRow>(db, "works", input.slug, "create_work");
  if (taken) {
    return yield* new CmsError({
      message: `Work slug taken: ${input.slug}`,
      status: HttpStatus.Conflict,
      operation: "create_work",
    });
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const html = yield* renderTiptapHtml(input.content, mediaUrlFor(adapterUrl));
  yield* insertDocRow(db, "works", toPostRow(input, html, id, now, now), "create_work");
  yield* recordRevision(db, "work", id, input, actor, "create_work");
  return yield* readWorkById(db, id, "create_work");
});

export const updateWork = Effect.fn("CmsService.updateWork")(function* (
  db: CmsD1Binding,
  slug: string,
  input: CmsWorkInput,
  actor: string,
  adapterUrl: string,
) {
  yield* rejectReservedSlug(slug, "update_work");
  if (input.slug !== slug) {
    return yield* new CmsError({
      message: "Work slug is immutable",
      status: HttpStatus.BadRequest,
      operation: "update_work",
    });
  }
  const existing = yield* findRowBySlug<WorkRow>(db, "works", slug, "update_work");
  if (!existing) {
    return yield* new CmsError({
      message: `Work not found: ${slug}`,
      status: HttpStatus.NotFound,
      operation: "update_work",
    });
  }
  const now = new Date().toISOString();
  const html = yield* renderTiptapHtml(input.content, mediaUrlFor(adapterUrl));
  const row = toPostRow(input, html, existing.id, now, existing.created_at);
  yield* updateDocRow(db, "works", row, "update_work");
  yield* recordRevision(db, "work", row.id, input, actor, "update_work");
  return yield* readWorkById(db, row.id, "update_work");
});

export const deleteWork = Effect.fn("CmsService.deleteWork")(function* (
  db: CmsD1Binding,
  slug: string,
) {
  return yield* deleteRowBySlug(db, "works", "Work", slug, "delete_work");
});

export const createCategory = Effect.fn("CmsService.createCategory")(function* (
  db: CmsD1Binding,
  input: CmsCategoryInput,
) {
  const taken = yield* findRowBySlug<{ id: string }>(
    db,
    "categories",
    input.slug,
    "create_category",
  );
  if (taken) {
    return yield* new CmsError({
      message: `Category slug taken: ${input.slug}`,
      status: HttpStatus.Conflict,
      operation: "create_category",
    });
  }
  const id = crypto.randomUUID();
  yield* runStatement(
    db,
    "INSERT INTO categories (id, slug, title) VALUES (?, ?, ?)",
    [id, input.slug, input.title],
    "create_category",
  );
  return { id, slug: input.slug, title: input.title };
});

export const deleteCategory = Effect.fn("CmsService.deleteCategory")(function* (
  db: CmsD1Binding,
  slug: string,
) {
  return yield* deleteRowBySlug(db, "categories", "Category", slug, "delete_category");
});

export const createMedia = Effect.fn("CmsService.createMedia")(function* (
  db: CmsD1Binding,
  r2: CmsR2Binding,
  upload: MediaUpload,
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const key = `media/${id}/${upload.name}`;
  yield* Effect.tryPromise({
    try: () => r2.put(key, upload.bytes, { httpMetadata: { contentType: upload.mime } }),
    catch: (cause) =>
      new CmsError({
        message: "Media upload failed",
        status: HttpStatus.InternalServerError,
        operation: "create_media",
        cause,
      }),
  });
  yield* runStatement(
    db,
    "INSERT INTO media (id, key, mime, width, height, alt, caption, variants_json, " +
      "created_at, updated_at) VALUES (?, ?, ?, NULL, NULL, ?, ?, '[]', ?, ?)",
    [id, key, upload.mime, upload.alt, upload.caption, now, now],
    "create_media",
  );
  const row = yield* queryFirst<MediaRow>(
    db,
    `SELECT ${MEDIA_COLUMNS} FROM media WHERE id = ? LIMIT 1`,
    [id],
    "create_media",
  );
  if (!row) {
    return yield* new CmsError({
      message: "Media not found after upload",
      status: HttpStatus.InternalServerError,
      operation: "create_media",
    });
  }
  return yield* toMedia(row);
});

export const deleteMedia = Effect.fn("CmsService.deleteMedia")(function* (
  db: CmsD1Binding,
  r2: CmsR2Binding,
  id: string,
) {
  const row = yield* requireMediaRow(db, id, "delete_media");
  // Never orphan published content: the editor checks usage first, and
  // the service enforces it so direct API calls cannot break posts/works.
  const usage = yield* getMediaUsage(db, id);
  if (usage.posts.length > 0 || usage.works.length > 0) {
    return yield* new CmsError({
      message: `Media in use by ${usage.posts.length} posts and ${usage.works.length} works`,
      status: HttpStatus.Conflict,
      operation: "delete_media",
    });
  }
  // D1 first: a failed R2 delete then leaves orphaned bytes (cheap), never
  // a published post pointing at a missing row.
  yield* runStatement(db, "DELETE FROM media WHERE id = ?", [id], "delete_media");
  yield* Effect.tryPromise({
    try: () => r2.delete(row.key),
    catch: (cause) =>
      new CmsError({
        message: "Media delete failed",
        status: HttpStatus.InternalServerError,
        operation: "delete_media",
        cause,
      }),
  });
  return { id };
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

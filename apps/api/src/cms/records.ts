import { Effect, Schema } from "effect";
import {
  CmsCategorySchema,
  CmsMediaSchema,
  CmsMediaUsageRefSchema,
  CmsMediaVariantSchema,
  CmsPostInputSchema,
  CmsPostSchema,
  CmsPostSummarySchema,
  CmsRevisionMetaSchema,
  CmsWorkInputSchema,
  CmsWorkSchema,
  CmsWorkSummarySchema,
  TiptapDocSchema,
} from "@tom/schemas/cms";
import type { CmsCategory, CmsRevisionEntity, CmsRevisionSnapshot } from "@tom/schemas/cms";
import { CmsError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import type { CmsD1Binding, CmsD1Statement } from "@tom/utils/config";

/**
 * Storage substrate shared by the CMS read and command modules. Row codecs,
 * decoders, and statement builders live here so a read and a write can never
 * disagree about a column or a shape.
 */

export const POST_COLUMN_LIST = [
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

export const POST_COLUMNS = POST_COLUMN_LIST.join(", ");

/**
 * List columns: everything except the heavy body (content_json, html).
 * Derived from POST_COLUMNS so a new column cannot silently miss the
 * summary selects (a missing column 500s the summary decode instead).
 */
export const POST_SUMMARY_COLUMNS = POST_COLUMN_LIST.filter(
  (column) => column !== "p.content_json" && column !== "p.html",
).join(", ");

/**
 * D1 row codecs: camelCase decoded fields map to snake_case columns via
 * encodeKeys, and content_json/variants_json parse inside the same decode.
 */
export const PostRowSchema = Schema.Struct({
  id: Schema.String,
  slug: Schema.String,
  title: Schema.String,
  summary: Schema.NullOr(Schema.String),
  content: Schema.fromJsonString(TiptapDocSchema),
  html: Schema.String,
  status: Schema.String,
  publishedAt: Schema.NullOr(Schema.String),
  heroMediaId: Schema.NullOr(Schema.String),
  metaTitle: Schema.NullOr(Schema.String),
  metaDescription: Schema.NullOr(Schema.String),
  metaImage: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
}).pipe(
  Schema.encodeKeys({
    content: "content_json",
    publishedAt: "published_at",
    heroMediaId: "hero_media_id",
    metaTitle: "meta_title",
    metaDescription: "meta_description",
    metaImage: "meta_image",
    createdAt: "created_at",
    updatedAt: "updated_at",
  }),
);

export type PostRow = typeof PostRowSchema.Type;

export const PostSummaryRowSchema = Schema.Struct({
  id: Schema.String,
  slug: Schema.String,
  title: Schema.String,
  summary: Schema.NullOr(Schema.String),
  status: Schema.String,
  publishedAt: Schema.NullOr(Schema.String),
  heroMediaId: Schema.NullOr(Schema.String),
  metaTitle: Schema.NullOr(Schema.String),
  metaDescription: Schema.NullOr(Schema.String),
  metaImage: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
}).pipe(
  Schema.encodeKeys({
    publishedAt: "published_at",
    heroMediaId: "hero_media_id",
    metaTitle: "meta_title",
    metaDescription: "meta_description",
    metaImage: "meta_image",
    createdAt: "created_at",
    updatedAt: "updated_at",
  }),
);

export const MEDIA_COLUMNS =
  "id, key, mime, width, height, alt, caption, variants_json, created_at, updated_at";

export const MediaRowSchema = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  mime: Schema.String,
  width: Schema.NullOr(Schema.Finite),
  height: Schema.NullOr(Schema.Finite),
  alt: Schema.NullOr(Schema.String),
  caption: Schema.NullOr(Schema.String),
  variants: Schema.fromJsonString(Schema.Array(CmsMediaVariantSchema)),
  createdAt: Schema.String,
  updatedAt: Schema.String,
}).pipe(
  Schema.encodeKeys({
    variants: "variants_json",
    createdAt: "created_at",
    updatedAt: "updated_at",
  }),
);

/** pc.post_id arrives aliased as postId, so no encodeKeys mapping. */
const CategoryLinkRowSchema = Schema.Struct({
  postId: Schema.String,
  id: Schema.String,
  slug: Schema.String,
  title: Schema.String,
});

export const RevisionRowSchema = Schema.Struct({
  id: Schema.String,
  snapshotJson: Schema.String,
  actor: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
}).pipe(Schema.encodeKeys({ snapshotJson: "snapshot_json", createdAt: "created_at" }));

// encodeKeys renames keys 1:1; it cannot fold meta_title/description/image
// into one nested object, so meta stays a pure mapper.
const withMeta = <T extends typeof PostSummaryRowSchema.Type>(
  row: T,
): Omit<T, "metaTitle" | "metaDescription" | "metaImage"> & {
  readonly meta: {
    readonly title: string | null;
    readonly description: string | null;
    readonly image: string | null;
  };
} => {
  const { metaTitle, metaDescription, metaImage, ...rest } = row;
  return {
    ...rest,
    meta: { title: metaTitle, description: metaDescription, image: metaImage },
  };
};

export const queryAll = <T>(
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

export const queryFirst = <T>(
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

/** A bound statement, ready for a single `run()` or a transactional batch. */
export const statement = (
  db: CmsD1Binding,
  sql: string,
  params: ReadonlyArray<string | number | null>,
): CmsD1Statement => db.prepare(sql).bind(...params);

/**
 * D1 names the violated column, e.g. `UNIQUE constraint failed: posts.slug`.
 * The pre-write lookup catches a taken slug, but two concurrent creates can
 * both pass it; only this constraint recognises the loser of that race.
 */
const DUPLICATE_SLUG_CONSTRAINT = /UNIQUE constraint failed: (?:posts|works|categories)\.slug\b/;

const isDuplicateSlug = (cause: unknown): boolean =>
  DUPLICATE_SLUG_CONSTRAINT.test(cause instanceof Error ? cause.message : String(cause));

/**
 * Run the write set in one D1 batch. D1 executes a batch as a transaction, so
 * a document, its category links, and its revision either all land or none
 * do — the previous sequential writes could leave a post with no revision or
 * a half-replaced category set. A unique slug violation is a 409 because the
 * request lost a race, not a server fault; every other D1 failure stays a 500.
 */
export const writeBatch = (
  db: CmsD1Binding,
  statements: ReadonlyArray<CmsD1Statement>,
  operation: string,
): Effect.Effect<void, CmsError> =>
  Effect.tryPromise({
    try: () => db.batch(statements),
    catch: (cause) =>
      isDuplicateSlug(cause)
        ? new CmsError({
            message: "Slug already taken",
            status: HttpStatus.Conflict,
            operation,
            cause,
          })
        : new CmsError({
            message: "CMS write failed",
            status: HttpStatus.InternalServerError,
            operation,
            cause,
          }),
  }).pipe(Effect.asVoid);

/** Decode an internal row against its owner schema; corrupt rows fail with 500. */
export const decodeCms = <A, I, B>(
  schema: Schema.Codec<A, I>,
  value: B,
  message: string,
  operation: string,
): Effect.Effect<A, CmsError> =>
  Schema.decodeUnknownEffect(schema)(value).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message,
          status: HttpStatus.InternalServerError,
          operation,
          cause,
        }),
    ),
  );

export const toPost = Effect.fn("CmsService.toPost")(function* (
  row: typeof PostRowSchema.Encoded,
  categories: ReadonlyArray<CmsCategory>,
) {
  const decoded = yield* decodeCms(PostRowSchema, row, "Invalid CMS post row", "decode_post");
  return yield* decodeCms(
    CmsPostSchema,
    { ...withMeta(decoded), categories },
    "Invalid CMS post row",
    "decode_post",
  );
});

export const toWork = Effect.fn("CmsService.toWork")(function* (row: typeof PostRowSchema.Encoded) {
  const decoded = yield* decodeCms(PostRowSchema, row, "Invalid CMS work row", "decode_work");
  return yield* decodeCms(CmsWorkSchema, withMeta(decoded), "Invalid CMS work row", "decode_work");
});

/** Slim post row: the body never leaves D1; categories attach after decode. */
export const toPostSummary = Effect.fn("CmsService.toPostSummary")(function* (
  row: typeof PostSummaryRowSchema.Encoded,
  categories: ReadonlyArray<CmsCategory>,
) {
  const decoded = yield* decodeCms(
    PostSummaryRowSchema,
    row,
    "Invalid CMS post row",
    "decode_post_summary",
  );
  return yield* decodeCms(
    CmsPostSummarySchema,
    { ...withMeta(decoded), categories },
    "Invalid CMS post row",
    "decode_post_summary",
  );
});

/** Slim work row: no Tiptap parse, no HTML. */
export const toWorkSummary = Effect.fn("CmsService.toWorkSummary")(function* (
  row: typeof PostSummaryRowSchema.Encoded,
) {
  const decoded = yield* decodeCms(
    PostSummaryRowSchema,
    row,
    "Invalid CMS work row",
    "decode_work_summary",
  );
  return yield* decodeCms(
    CmsWorkSummarySchema,
    withMeta(decoded),
    "Invalid CMS work row",
    "decode_work_summary",
  );
});

export const toMedia = Effect.fn("CmsService.toMedia")(function* (
  row: typeof MediaRowSchema.Encoded,
) {
  const decoded = yield* decodeCms(MediaRowSchema, row, "Invalid CMS media row", "decode_media");
  return yield* decodeCms(CmsMediaSchema, decoded, "Invalid CMS media row", "decode_media");
});

export const categoriesForPosts = Effect.fn("CmsService.categoriesForPosts")(function* (
  db: CmsD1Binding,
  postIds: ReadonlyArray<string>,
  operation: string,
) {
  const grouped: Record<string, Array<CmsCategory>> = {};
  if (postIds.length === 0) return grouped;
  const placeholders = postIds.map(() => "?").join(",");
  const rows = yield* queryAll<typeof CategoryLinkRowSchema.Encoded>(
    db,
    "SELECT pc.post_id AS postId, c.id, c.slug, c.title FROM post_categories pc " +
      "JOIN categories c ON c.id = pc.category_id " +
      `WHERE pc.post_id IN (${placeholders})`,
    postIds,
    operation,
  );
  for (const row of rows) {
    const link = yield* decodeCms(
      CategoryLinkRowSchema,
      row,
      "Invalid CMS category row",
      operation,
    );
    const category = yield* decodeCms(
      CmsCategorySchema,
      {
        id: link.id,
        slug: link.slug,
        title: link.title,
      },
      "Invalid CMS category row",
      operation,
    );
    const existing = grouped[link.postId] ?? [];
    grouped[link.postId] = [...existing, category];
  }
  return grouped;
});

export const findRowBySlug = <T>(
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

/**
 * The stored post/work row, decoded. The update path needs the real
 * `createdAt` instant, so it cannot read the raw D1 string.
 */
export const requireDecodedRow = Effect.fn("CmsService.requireDecodedRow")(function* (
  db: CmsD1Binding,
  table: "posts" | "works",
  slug: string,
  label: string,
  operation: string,
) {
  const row = yield* findRowBySlug<typeof PostRowSchema.Encoded>(db, table, slug, operation);
  if (!row) {
    return yield* new CmsError({
      message: `${label} not found: ${slug}`,
      status: HttpStatus.NotFound,
      operation,
    });
  }
  return yield* decodeCms(PostRowSchema, row, `Invalid CMS ${label.toLowerCase()} row`, operation);
});

export const readPostById = Effect.fn("CmsService.readPostById")(function* (
  db: CmsD1Binding,
  id: string,
  operation: string,
) {
  const row = yield* queryFirst<typeof PostRowSchema.Encoded>(
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

export const readWorkById = Effect.fn("CmsService.readWorkById")(function* (
  db: CmsD1Binding,
  id: string,
  operation: string,
) {
  const row = yield* queryFirst<typeof PostRowSchema.Encoded>(
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

/** Load a media row by id, failing the operation with 404 when absent. */
export const requireMediaRow = Effect.fn("CmsService.requireMediaRow")(function* (
  db: CmsD1Binding,
  id: string,
  operation: string,
) {
  const row = yield* queryFirst<typeof MediaRowSchema.Encoded>(
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

const usageRefs = Effect.fn("CmsService.usageRefs")(function* (
  db: CmsD1Binding,
  table: "posts" | "works",
  id: string,
  operation: string,
) {
  const rows = yield* queryAll<typeof CmsMediaUsageRefSchema.Encoded>(
    db,
    // Match the bare id: stored JSON spacing varies (compact or spaced),
    // and a UUID never appears in prose by accident.
    `SELECT slug, title FROM ${table} WHERE hero_media_id = ? OR instr(content_json, ?) > 0 ` +
      "ORDER BY title COLLATE NOCASE ASC",
    [id, id],
    operation,
  );
  return yield* Effect.forEach(rows, (row) =>
    decodeCms(CmsMediaUsageRefSchema, row, "Invalid CMS usage row", operation),
  );
});

export const mediaUsage = Effect.fn("CmsService.mediaUsage")(function* (
  db: CmsD1Binding,
  id: string,
  operation: string,
) {
  const [posts, works] = yield* Effect.all(
    [usageRefs(db, "posts", id, operation), usageRefs(db, "works", id, operation)],
    { concurrency: "unbounded" },
  );
  return { posts, works };
});

export const decodeJsonSnapshot = <A, I, B>(
  schema: Schema.Codec<A, I>,
  json: B,
  operation: string,
): Effect.Effect<A, CmsError> =>
  decodeCms(Schema.fromJsonString(schema), json, "Invalid revision snapshot", operation);

export const parseSnapshot = (
  json: string,
  entity: CmsRevisionEntity,
  operation: string,
): Effect.Effect<CmsRevisionSnapshot, CmsError> =>
  entity === "post"
    ? decodeJsonSnapshot(CmsPostInputSchema, json, operation)
    : decodeJsonSnapshot(CmsWorkInputSchema, json, operation);

export const toRevisionMeta = Effect.fn("CmsService.toRevisionMeta")(function* (
  row: typeof RevisionRowSchema.Encoded,
  entity: CmsRevisionEntity,
  operation: string,
) {
  const decoded = yield* decodeCms(RevisionRowSchema, row, "Invalid revision row", operation);
  const snapshot = yield* parseSnapshot(decoded.snapshotJson, entity, operation);
  return yield* decodeCms(
    CmsRevisionMetaSchema,
    {
      id: decoded.id,
      createdAt: decoded.createdAt,
      actor: decoded.actor,
      title: snapshot.title,
    },
    "Invalid revision row",
    operation,
  );
});

export const revisionTable = (entity: CmsRevisionEntity): "posts" | "works" =>
  entity === "post" ? "posts" : "works";

export const findRevisionTarget = Effect.fn("CmsService.findRevisionTarget")(function* (
  db: CmsD1Binding,
  entity: CmsRevisionEntity,
  slug: string,
  operation: string,
) {
  const row = yield* findRowBySlug<typeof PostRowSchema.Encoded>(
    db,
    revisionTable(entity),
    slug,
    operation,
  );
  if (!row) {
    return yield* new CmsError({
      message: entity === "post" ? `Post not found: ${slug}` : `Work not found: ${slug}`,
      status: HttpStatus.NotFound,
      operation,
    });
  }
  return row;
});

export const findRevisionRow = Effect.fn("CmsService.findRevisionRow")(function* (
  db: CmsD1Binding,
  entity: CmsRevisionEntity,
  entityId: string,
  revisionId: string,
  operation: string,
) {
  const row = yield* queryFirst<typeof RevisionRowSchema.Encoded>(
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

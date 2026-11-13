import { DateTime, Effect, Schema } from "effect";
import { CmsPostInputSchema, CmsWorkInputSchema } from "@tom/schemas/cms";
import type {
  CmsCategoryInput,
  CmsMediaId,
  CmsPostInput,
  CmsRevisionEntity,
  CmsWorkInput,
} from "@tom/schemas/cms";
import { CmsError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import type { CmsD1Binding, CmsD1Statement, CmsR2Binding } from "@tom/utils/config";
import { renderTiptapHtml } from "@tom/utils/tiptap-html";
import {
  MEDIA_COLUMNS,
  MediaRowSchema,
  PostRowSchema,
  type PostRow,
  decodeJsonSnapshot,
  findRevisionRow,
  findRevisionTarget,
  findRowBySlug,
  mediaUsage,
  queryAll,
  queryFirst,
  readPostById,
  readWorkById,
  requireDecodedRow,
  requireMediaRow,
  statement,
  toMedia,
  writeBatch,
} from "./records";

/**
 * CMS commands. Every command validates before it writes and then commits the
 * whole write set in one D1 batch, so a rejected category, a failed revision,
 * or a duplicate slug cannot leave a half-written document behind.
 */

/** Revisions kept per document; older snapshots prune in the same batch. */
const MAX_REVISIONS = 20;

/** Current instant, read once per command rather than per statement. */
const nowInstant: Effect.Effect<DateTime.Utc> = DateTime.now;

const isoOf = (instant: DateTime.Utc): string => DateTime.toDateUtc(instant).toISOString();

/**
 * Resolve the date a document will carry.
 *
 * - A draft may have no date, or a future date: that is a deliberate
 *   schedule and stays exactly as sent.
 * - A published document must carry a real, non-future instant. Publishing
 *   without a date stamps the transition; publishing with a future date is
 *   rejected because the document is already live on the public read path.
 * - Updating a published document without a date keeps its existing date
 *   instead of silently resetting it to now, unless that date is still in the
 *   future: publishing a scheduled draft stamps the transition, so a future
 *   date can never reach the public read path through a bare publish.
 */
const publishableAt = (
  input: { readonly status: CmsPostInput["status"]; readonly publishedAt: DateTime.Utc | null },
  existingPublishedAt: string | null,
  now: DateTime.Utc,
  operation: string,
): Effect.Effect<string | null, CmsError> => {
  if (input.status === "draft") {
    return Effect.succeed(input.publishedAt === null ? null : isoOf(input.publishedAt));
  }
  if (input.publishedAt !== null) {
    return DateTime.toEpochMillis(input.publishedAt) > DateTime.toEpochMillis(now)
      ? Effect.fail(
          new CmsError({
            message:
              "A published document cannot have a future publishedAt; save it as a draft to schedule it",
            status: HttpStatus.BadRequest,
            operation,
          }),
        )
      : Effect.succeed(isoOf(input.publishedAt));
  }
  return Effect.succeed(
    existingPublishedAt === null || Date.parse(existingPublishedAt) > DateTime.toEpochMillis(now)
      ? isoOf(now)
      : existingPublishedAt,
  );
};

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

/**
 * Every category id must exist before anything is written. The old path
 * deleted the links first and only then checked the ids, so a bad id wiped a
 * post's categories and left it published with none.
 */
const requireKnownCategories = (
  db: CmsD1Binding,
  categoryIds: ReadonlyArray<string>,
  operation: string,
): Effect.Effect<ReadonlyArray<string>, CmsError> =>
  Effect.gen(function* () {
    const uniqueIds = [...new Set(categoryIds)];
    if (uniqueIds.length === 0) return uniqueIds;
    const placeholders = uniqueIds.map(() => "?").join(",");
    const known = yield* queryAll<{ readonly id: string }>(
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
    return uniqueIds;
  });

const categoryStatements = (
  db: CmsD1Binding,
  postId: string,
  categoryIds: ReadonlyArray<string>,
): ReadonlyArray<CmsD1Statement> => [
  statement(db, "DELETE FROM post_categories WHERE post_id = ?", [postId]),
  ...categoryIds.map((categoryId) =>
    statement(db, "INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)", [
      postId,
      categoryId,
    ]),
  ),
];

/**
 * Snapshot a write input as a revision, then prune past the cap in the same
 * batch. The snapshot is exactly what create/update accepts, so a restore
 * replays it through the normal update path (and records its own revision).
 */
const revisionStatements = (
  db: CmsD1Binding,
  entity: CmsRevisionEntity,
  entityId: string,
  snapshot: CmsPostInput | CmsWorkInput,
  actor: string,
  now: string,
): ReadonlyArray<CmsD1Statement> => [
  statement(
    db,
    "INSERT INTO revisions (id, entity_type, entity_id, snapshot_json, actor, created_at) " +
      "VALUES (?, ?, ?, ?, ?, ?)",
    [crypto.randomUUID(), entity, entityId, JSON.stringify(snapshot), actor, now],
  ),
  statement(
    db,
    "DELETE FROM revisions WHERE entity_type = ? AND entity_id = ? AND id NOT IN " +
      "(SELECT id FROM revisions WHERE entity_type = ? AND entity_id = ? " +
      "ORDER BY created_at DESC, rowid DESC LIMIT ?)",
    [entity, entityId, entity, entityId, MAX_REVISIONS],
  ),
];

/**
 * Build the stored row in decoded shape. `content` becomes a JSON string and
 * the timestamps ISO strings through `encodeSync`, so nothing here formats a
 * timestamp or serialises JSON by hand.
 */
const toPostRow = (
  input: CmsPostInput | CmsWorkInput,
  html: string,
  id: string,
  now: string,
  createdAt: string,
  publishedAt: string | null,
): PostRow => ({
  id,
  slug: input.slug,
  title: input.title,
  summary: input.summary,
  content: input.content,
  html,
  status: input.status,
  publishedAt,
  heroMediaId: input.heroMediaId,
  metaTitle: input.meta.title,
  metaDescription: input.meta.description,
  metaImage: input.meta.image,
  createdAt,
  updatedAt: now,
});

const insertDocStatement = (
  db: CmsD1Binding,
  table: "posts" | "works",
  row: PostRow,
): CmsD1Statement => {
  const encoded = Schema.encodeSync(PostRowSchema)(row);
  return statement(
    db,
    `INSERT INTO ${table} (id, slug, title, summary, content_json, html, status, ` +
      "published_at, hero_media_id, meta_title, meta_description, meta_image, " +
      "created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [
      encoded.id,
      encoded.slug,
      encoded.title,
      encoded.summary,
      encoded.content_json,
      encoded.html,
      encoded.status,
      encoded.published_at,
      encoded.hero_media_id,
      encoded.meta_title,
      encoded.meta_description,
      encoded.meta_image,
      encoded.created_at,
      encoded.updated_at,
    ],
  );
};

const updateDocStatement = (
  db: CmsD1Binding,
  table: "posts" | "works",
  row: PostRow,
): CmsD1Statement => {
  const encoded = Schema.encodeSync(PostRowSchema)(row);
  return statement(
    db,
    `UPDATE ${table} SET title = ?, summary = ?, content_json = ?, html = ?, status = ?, ` +
      "published_at = ?, hero_media_id = ?, meta_title = ?, meta_description = ?, " +
      "meta_image = ?, updated_at = ? WHERE id = ?",
    [
      encoded.title,
      encoded.summary,
      encoded.content_json,
      encoded.html,
      encoded.status,
      encoded.published_at,
      encoded.hero_media_id,
      encoded.meta_title,
      encoded.meta_description,
      encoded.meta_image,
      encoded.updated_at,
      encoded.id,
    ],
  );
};

const mediaUrlFor =
  (adapterUrl: string) =>
  (mediaId: CmsMediaId | string): string =>
    `${adapterUrl}/content/media/${mediaId}/file`;

export const createPost = Effect.fn("CmsService.createPost")(function* (
  db: CmsD1Binding,
  input: CmsPostInput,
  actor: string,
  adapterUrl: string,
) {
  yield* rejectReservedSlug(input.slug, "create_post");
  const taken = yield* findRowBySlug<typeof PostRowSchema.Encoded>(
    db,
    "posts",
    input.slug,
    "create_post",
  );
  if (taken) {
    return yield* new CmsError({
      message: `Post slug taken: ${input.slug}`,
      status: HttpStatus.Conflict,
      operation: "create_post",
    });
  }
  const categoryIds = yield* requireKnownCategories(db, input.categoryIds, "create_post");
  const now = yield* nowInstant;
  const nowIso = isoOf(now);
  const publishedAt = yield* publishableAt(input, null, now, "create_post");
  const html = yield* renderTiptapHtml(input.content, mediaUrlFor(adapterUrl));

  const id = crypto.randomUUID();
  yield* writeBatch(
    db,
    [
      insertDocStatement(db, "posts", toPostRow(input, html, id, nowIso, nowIso, publishedAt)),
      ...categoryStatements(db, id, categoryIds),
      ...revisionStatements(db, "post", id, input, actor, nowIso),
    ],
    "create_post",
  );
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
  const existing = yield* requireDecodedRow(db, "posts", slug, "Post", "update_post");
  const categoryIds = yield* requireKnownCategories(db, input.categoryIds, "update_post");
  const now = yield* nowInstant;
  const nowIso = isoOf(now);
  const publishedAt = yield* publishableAt(input, existing.publishedAt, now, "update_post");
  const html = yield* renderTiptapHtml(input.content, mediaUrlFor(adapterUrl));

  const row = toPostRow(input, html, existing.id, nowIso, existing.createdAt, publishedAt);
  yield* writeBatch(
    db,
    [
      updateDocStatement(db, "posts", row),
      ...categoryStatements(db, row.id, categoryIds),
      ...revisionStatements(db, "post", row.id, input, actor, nowIso),
    ],
    "update_post",
  );
  return yield* readPostById(db, row.id, "update_post");
});

export const createWork = Effect.fn("CmsService.createWork")(function* (
  db: CmsD1Binding,
  input: CmsWorkInput,
  actor: string,
  adapterUrl: string,
) {
  yield* rejectReservedSlug(input.slug, "create_work");
  const taken = yield* findRowBySlug<typeof PostRowSchema.Encoded>(
    db,
    "works",
    input.slug,
    "create_work",
  );
  if (taken) {
    return yield* new CmsError({
      message: `Work slug taken: ${input.slug}`,
      status: HttpStatus.Conflict,
      operation: "create_work",
    });
  }
  const now = yield* nowInstant;
  const nowIso = isoOf(now);
  const publishedAt = yield* publishableAt(input, null, now, "create_work");
  const html = yield* renderTiptapHtml(input.content, mediaUrlFor(adapterUrl));

  const id = crypto.randomUUID();
  yield* writeBatch(
    db,
    [
      insertDocStatement(db, "works", toPostRow(input, html, id, nowIso, nowIso, publishedAt)),
      ...revisionStatements(db, "work", id, input, actor, nowIso),
    ],
    "create_work",
  );
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
  const existing = yield* requireDecodedRow(db, "works", slug, "Work", "update_work");
  const now = yield* nowInstant;
  const nowIso = isoOf(now);
  const publishedAt = yield* publishableAt(input, existing.publishedAt, now, "update_work");
  const html = yield* renderTiptapHtml(input.content, mediaUrlFor(adapterUrl));

  const row = toPostRow(input, html, existing.id, nowIso, existing.createdAt, publishedAt);
  yield* writeBatch(
    db,
    [
      updateDocStatement(db, "works", row),
      ...revisionStatements(db, "work", row.id, input, actor, nowIso),
    ],
    "update_work",
  );
  return yield* readWorkById(db, row.id, "update_work");
});

const requireRowId = Effect.fn("CmsService.requireRowId")(function* (
  db: CmsD1Binding,
  table: "posts" | "works" | "categories",
  slug: string,
  label: string,
  operation: string,
) {
  const existing = yield* findRowBySlug<{ readonly id: string }>(db, table, slug, operation);
  if (!existing) {
    return yield* new CmsError({
      message: `${label} not found: ${slug}`,
      status: HttpStatus.NotFound,
      operation,
    });
  }
  return existing;
});

export const deletePost = Effect.fn("CmsService.deletePost")(function* (
  db: CmsD1Binding,
  slug: string,
) {
  const existing = yield* requireRowId(db, "posts", slug, "Post", "delete_post");
  yield* writeBatch(
    db,
    [
      statement(db, "DELETE FROM post_categories WHERE post_id = ?", [existing.id]),
      // Revisions have no foreign key, so deleting the document must take them
      // with it or the history outlives the post it describes.
      statement(db, "DELETE FROM revisions WHERE entity_type = 'post' AND entity_id = ?", [
        existing.id,
      ]),
      statement(db, "DELETE FROM posts WHERE id = ?", [existing.id]),
    ],
    "delete_post",
  );
  return { id: existing.id };
});

export const deleteWork = Effect.fn("CmsService.deleteWork")(function* (
  db: CmsD1Binding,
  slug: string,
) {
  const existing = yield* requireRowId(db, "works", slug, "Work", "delete_work");
  yield* writeBatch(
    db,
    [
      statement(db, "DELETE FROM revisions WHERE entity_type = 'work' AND entity_id = ?", [
        existing.id,
      ]),
      statement(db, "DELETE FROM works WHERE id = ?", [existing.id]),
    ],
    "delete_work",
  );
  return { id: existing.id };
});

export const createCategory = Effect.fn("CmsService.createCategory")(function* (
  db: CmsD1Binding,
  input: CmsCategoryInput,
) {
  const taken = yield* findRowBySlug<{ readonly id: string }>(
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
  yield* writeBatch(
    db,
    [
      statement(db, "INSERT INTO categories (id, slug, title) VALUES (?, ?, ?)", [
        id,
        input.slug,
        input.title,
      ]),
    ],
    "create_category",
  );
  return { id, slug: input.slug, title: input.title };
});

export const deleteCategory = Effect.fn("CmsService.deleteCategory")(function* (
  db: CmsD1Binding,
  slug: string,
) {
  const existing = yield* requireRowId(db, "categories", slug, "Category", "delete_category");
  yield* writeBatch(
    db,
    [
      // Remove the links in the same transaction as the row; relying on the
      // foreign-key cascade made the delete's atomicity implicit.
      statement(db, "DELETE FROM post_categories WHERE category_id = ?", [existing.id]),
      statement(db, "DELETE FROM categories WHERE id = ?", [existing.id]),
    ],
    "delete_category",
  );
  return { id: existing.id };
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

export type MediaUpload = {
  readonly name: string;
  readonly mime: string;
  readonly bytes: ArrayBuffer;
  readonly alt: string | null;
  readonly caption: string | null;
};

/**
 * Best-effort object removal. Used to compensate a failed D1 write and to
 * finish a delete whose row is already gone; neither caller can undo the
 * other side, so a failure is logged and the orphan is left for a sweep
 * rather than turned into a second error the caller cannot act on.
 */
const purgeMediaObject = (
  r2: CmsR2Binding,
  key: string,
  operation: string,
): Effect.Effect<void, never> =>
  Effect.tryPromise({
    try: () => r2.delete(key),
    catch: (cause) => String(cause),
  }).pipe(
    Effect.catch((cause) => Effect.logWarning("cms:media:orphan", { key, operation, cause })),
  );

export const createMedia = Effect.fn("CmsService.createMedia")(function* (
  db: CmsD1Binding,
  r2: CmsR2Binding,
  upload: MediaUpload,
) {
  const id = crypto.randomUUID();
  const now = isoOf(yield* nowInstant);
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
  // R2 and D1 cannot join one transaction. If the row cannot be written, the
  // object is unreachable garbage, so remove it instead of leaking bytes.
  yield* writeBatch(
    db,
    [
      statement(
        db,
        "INSERT INTO media (id, key, mime, width, height, alt, caption, variants_json, " +
          "created_at, updated_at) VALUES (?, ?, ?, NULL, NULL, ?, ?, '[]', ?, ?)",
        [id, key, upload.mime, upload.alt, upload.caption, now, now],
      ),
    ],
    "create_media",
  ).pipe(
    Effect.catch((error) =>
      Effect.gen(function* () {
        yield* purgeMediaObject(r2, key, "create_media");
        return yield* error;
      }),
    ),
  );
  const row = yield* queryFirst<typeof MediaRowSchema.Encoded>(
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
  // Never orphan published content: the editor checks usage first, and
  // the service enforces it so direct API calls cannot break posts/works.
  const [row, usage] = yield* Effect.all(
    [requireMediaRow(db, id, "delete_media"), mediaUsage(db, id, "delete_media")],
    { concurrency: "unbounded" },
  );
  if (usage.posts.length > 0 || usage.works.length > 0) {
    return yield* new CmsError({
      message: `Media in use by ${usage.posts.length} posts and ${usage.works.length} works`,
      status: HttpStatus.Conflict,
      operation: "delete_media",
    });
  }
  // D1 first: a failed R2 delete then leaves orphaned bytes (cheap), never a
  // published post pointing at a missing row. The object purge is best-effort
  // because the row is already the authority and a retry would 404.
  yield* writeBatch(db, [statement(db, "DELETE FROM media WHERE id = ?", [id])], "delete_media");
  yield* purgeMediaObject(r2, row.key, "delete_media");
  return { id };
});

import { Elysia } from "elysia";
import { Effect, Option, Schema } from "effect";
import {
  CmsCategoryInputSchema,
  CmsPostInputSchema,
  CmsRestoreInputSchema,
  CmsWorkInputSchema,
} from "@tom/schemas/cms";
import { CmsError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import type { CmsD1Binding, CmsR2Binding } from "@tom/utils/services/config";
import { parseAdminEmails, readCloudflareEnv, tenantFromValue } from "@tom/utils/services/config";
import { getRequestEnv, logContextFromRequest, runEffect } from "@tom/utils/services/worker";
import { createAuthFromEnv, isAdminEmail, requireSession } from "../services/auth";
import type { MediaUpload } from "../services/cms";
import {
  createCategory,
  createMedia,
  createPost,
  createWork,
  deleteCategory,
  deleteMedia,
  deletePost,
  deleteWork,
  getMediaUsage,
  getRevision,
  listMedia,
  listRevisions,
  restoreRevision,
  updatePost,
  updateWork,
} from "../services/cms";
import {
  decodeBoundary,
  decodeMediaParams,
  decodePagingQuery,
  decodeSlugParams,
  requireCmsD1,
  requireCmsR2,
} from "./cms";

type AuthorContext = {
  readonly db: CmsD1Binding;
  readonly r2: CmsR2Binding;
  readonly adapterUrl: string;
  readonly actor: string;
};

/**
 * Author gate for CMS writes: storage bindings present, internal token
 * already checked by the guarded group in index.ts, and a live admin
 * session on the request cookies. Fail-closed on every branch.
 */
const requireAuthor = (request: Request): Effect.Effect<AuthorContext, CmsError> =>
  Effect.gen(function* () {
    const env = yield* Effect.tryPromise({
      try: () => readCloudflareEnv(getRequestEnv(request)),
      catch: (cause) =>
        new CmsError({
          message: "Failed to load configuration",
          status: HttpStatus.InternalServerError,
          operation: "cms_auth",
          cause,
        }),
    });
    const db = yield* requireCmsD1(env);
    const r2 = yield* requireCmsR2(env);
    const auth = yield* createAuthFromEnv(env);
    const author = yield* requireSession(auth, request.headers);
    // Sessions outlive allowlist edits: re-check membership on every
    // write so removing an email revokes access, not just future sign-ins.
    const email = Option.filter(Option.fromNullishOr(author.user.email), Schema.is(Schema.String));
    if (
      Option.isNone(email) ||
      !isAdminEmail(email.value, parseAdminEmails(env.CMS_ADMIN_EMAILS))
    ) {
      return yield* new CmsError({
        message: "Forbidden",
        status: HttpStatus.Forbidden,
        operation: "cms_auth",
      });
    }
    return {
      db,
      r2,
      adapterUrl: env.ADAPTER_URL ?? LOCAL_SERVICE_URLS.adapter,
      actor: email.value,
    };
  });

const failInput = (message: string, operation: string): Effect.Effect<never, CmsError> =>
  Effect.fail(
    new CmsError({
      message,
      status: HttpStatus.BadRequest,
      operation,
    }),
  );

// SVG is executable when served top-level, so it is never an upload
// type (existing rows stay served, hardened by response headers).
const UPLOAD_MIMES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "video/mp4",
  "video/webm",
]);

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const sanitizeFileName = (name: string): string => {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
  return cleaned.length > 0 ? cleaned : "upload";
};

const UploadFormSchema = Schema.Struct({
  file: Schema.instanceOf(File),
  alt: Schema.optional(Schema.String),
  caption: Schema.optional(Schema.String),
});

const asciiAt = (bytes: Uint8Array, offset: number, length: number): string => {
  let text = "";
  for (let index = offset; index < offset + length; index += 1) {
    text += String.fromCharCode(bytes[index] ?? 0);
  }
  return text;
};

const MP4_BRANDS: ReadonlySet<string> = new Set([
  "isom",
  "iso2",
  "iso3",
  "iso4",
  "iso5",
  "iso6",
  "mp41",
  "mp42",
  "avc1",
  "M4V",
  "M4A",
  "dash",
  "msdh",
  "msix",
]);

/**
 * Detect the true media type from magic bytes. The multipart Content-Type
 * is client-controlled, so bytes must match the claimed type or fail
 * closed — otherwise HTML/JS can masquerade as an image and be re-served
 * with an executable content type.
 */
const isJpegBytes = (bytes: Uint8Array): boolean =>
  bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

const isPngBytes = (bytes: Uint8Array): boolean =>
  bytes.length >= 8 &&
  bytes[0] === 0x89 &&
  bytes[1] === 0x50 &&
  bytes[2] === 0x4e &&
  bytes[3] === 0x47 &&
  bytes[4] === 0x0d &&
  bytes[5] === 0x0a &&
  bytes[6] === 0x1a &&
  bytes[7] === 0x0a;

const isWebpBytes = (bytes: Uint8Array): boolean =>
  bytes.length >= 12 && asciiAt(bytes, 0, 4) === "RIFF" && asciiAt(bytes, 8, 4) === "WEBP";

const isGifBytes = (bytes: Uint8Array): boolean =>
  bytes.length >= 6 && (asciiAt(bytes, 0, 6) === "GIF87a" || asciiAt(bytes, 0, 6) === "GIF89a");

const isWebmBytes = (bytes: Uint8Array): boolean =>
  bytes.length >= 12 &&
  bytes[0] === 0x1a &&
  bytes[1] === 0x45 &&
  bytes[2] === 0xdf &&
  bytes[3] === 0xa3;

/** ISO BMFF brand box: AVIF stills or MP4 video by major brand. */
const ftypMime = (bytes: Uint8Array): string | null => {
  if (bytes.length < 12 || asciiAt(bytes, 4, 4) !== "ftyp") return null;
  const brand = asciiAt(bytes, 8, 4);
  if (brand === "avif" || brand === "avis") return "image/avif";
  return MP4_BRANDS.has(brand) ? "video/mp4" : null;
};

const detectUploadMime = (bytes: Uint8Array): string | null => {
  if (isJpegBytes(bytes)) return "image/jpeg";
  if (isPngBytes(bytes)) return "image/png";
  if (isWebpBytes(bytes)) return "image/webp";
  if (isGifBytes(bytes)) return "image/gif";
  if (isWebmBytes(bytes)) return "video/webm";
  return ftypMime(bytes);
};

/** Decode a multipart upload body at the route boundary. */
const decodeUploadBody = <B>(body: B, operation: string): Effect.Effect<MediaUpload, CmsError> =>
  Effect.gen(function* () {
    const { file, alt, caption } = yield* decodeBoundary(
      UploadFormSchema,
      body,
      "Missing upload file",
      operation,
    );
    if (file.size === 0) {
      return yield* failInput("Upload file is empty", operation);
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return yield* new CmsError({
        message: "Upload file too large",
        status: HttpStatus.PayloadTooLarge,
        operation,
      });
    }
    if (!UPLOAD_MIMES.has(file.type)) {
      return yield* failInput(`Unsupported upload type: ${file.type}`, operation);
    }
    const bytes = yield* Effect.tryPromise({
      try: () => file.arrayBuffer(),
      catch: (cause) =>
        new CmsError({
          message: "Unreadable upload file",
          status: HttpStatus.BadRequest,
          operation,
          cause,
        }),
    });
    const detected = detectUploadMime(new Uint8Array(bytes));
    if (detected === null || detected !== file.type) {
      return yield* failInput(`Upload bytes do not match type: ${file.type}`, operation);
    }
    return {
      name: sanitizeFileName(file.name),
      mime: file.type,
      bytes,
      alt: alt ?? null,
      caption: caption ?? null,
    };
  });

const withAuthor = <A>(
  request: Request,
  use: (context: AuthorContext) => Effect.Effect<A, CmsError>,
): Effect.Effect<A, CmsError> =>
  Effect.gen(function* () {
    const context = yield* requireAuthor(request);
    return yield* use(context);
  });

/**
 * Sophie is a posts-only tenant: the editor hides works UI-side
 * (VITE_SOPHIE), and the Sophie-tenant API (TENANT=sophie, set in
 * infra/apps/api.run.ts) rejects /works/* writes server-side. Reads stay
 * served; unset TENANT keeps the legacy shared behavior.
 */
const requireWorksWritesAllowed = (request: Request): Effect.Effect<void, CmsError> =>
  tenantFromValue(getRequestEnv(request).TENANT) === "sophie"
    ? Effect.fail(
        new CmsError({
          message: "Works are not available on this tenant",
          status: HttpStatus.Forbidden,
          operation: "works_disabled",
        }),
      )
    : Effect.void;

const withWorksAuthor = <A>(
  request: Request,
  use: (context: AuthorContext) => Effect.Effect<A, CmsError>,
): Effect.Effect<A, CmsError> =>
  Effect.gen(function* () {
    yield* requireWorksWritesAllowed(request);
    return yield* withAuthor(request, use);
  });

const runWrite = <A>(request: Request, effect: Effect.Effect<A, CmsError>): Promise<A> =>
  runEffect(effect, logContextFromRequest(request, "tom-api"));

const CmsRevisionParamsSchema = Schema.Struct({ slug: Schema.String, revId: Schema.String });

/** Decode revision route params at the boundary (Elysia types them optional). */
const decodeRevisionParams = <P>(
  params: P,
  operation: string,
): Effect.Effect<{ readonly slug: string; readonly revId: string }, CmsError> =>
  decodeBoundary(CmsRevisionParamsSchema, params, "Invalid revision parameter", operation);

const decodeRestoreInput = <B>(
  body: B,
  operation: string,
): Effect.Effect<{ readonly revisionId: string }, CmsError> =>
  decodeBoundary(CmsRestoreInputSchema, body, "Invalid restore body", operation);

export const cmsWriteRoutes = new Elysia({ name: "cms-writes" })
  .post("/posts", ({ body, request }) =>
    runWrite(
      request,
      withAuthor(request, ({ db, actor, adapterUrl }) =>
        Effect.gen(function* () {
          const input = yield* decodeBoundary(
            CmsPostInputSchema,
            body,
            "Invalid post body",
            "create_post",
          );
          return yield* createPost(db, input, actor, adapterUrl);
        }),
      ),
    ),
  )
  .put("/posts/:slug", ({ body, params, request }) =>
    runWrite(
      request,
      withAuthor(request, ({ db, actor, adapterUrl }) =>
        Effect.gen(function* () {
          const { slug } = yield* decodeSlugParams(params, "update_post");
          const input = yield* decodeBoundary(
            CmsPostInputSchema,
            body,
            "Invalid post body",
            "update_post",
          );
          return yield* updatePost(db, slug, input, actor, adapterUrl);
        }),
      ),
    ),
  )
  .delete("/posts/:slug", ({ params, request }) =>
    runWrite(
      request,
      withAuthor(request, ({ db }) =>
        Effect.gen(function* () {
          const { slug } = yield* decodeSlugParams(params, "delete_post");
          return yield* deletePost(db, slug);
        }),
      ),
    ),
  )
  .post("/works", ({ body, request }) =>
    runWrite(
      request,
      withWorksAuthor(request, ({ db, actor, adapterUrl }) =>
        Effect.gen(function* () {
          const input = yield* decodeBoundary(
            CmsWorkInputSchema,
            body,
            "Invalid work body",
            "create_work",
          );
          return yield* createWork(db, input, actor, adapterUrl);
        }),
      ),
    ),
  )
  .put("/works/:slug", ({ body, params, request }) =>
    runWrite(
      request,
      withWorksAuthor(request, ({ db, actor, adapterUrl }) =>
        Effect.gen(function* () {
          const { slug } = yield* decodeSlugParams(params, "update_work");
          const input = yield* decodeBoundary(
            CmsWorkInputSchema,
            body,
            "Invalid work body",
            "update_work",
          );
          return yield* updateWork(db, slug, input, actor, adapterUrl);
        }),
      ),
    ),
  )
  .delete("/works/:slug", ({ params, request }) =>
    runWrite(
      request,
      withWorksAuthor(request, ({ db }) =>
        Effect.gen(function* () {
          const { slug } = yield* decodeSlugParams(params, "delete_work");
          return yield* deleteWork(db, slug);
        }),
      ),
    ),
  )
  .get("/posts/:slug/revisions", ({ params, request }) =>
    runWrite(
      request,
      withAuthor(request, ({ db }) =>
        Effect.gen(function* () {
          const { slug } = yield* decodeSlugParams(params, "list_revisions");
          return yield* listRevisions(db, "post", slug);
        }),
      ),
    ),
  )
  .get("/posts/:slug/revisions/:revId", ({ params, request }) =>
    runWrite(
      request,
      withAuthor(request, ({ db }) =>
        Effect.gen(function* () {
          const { slug, revId } = yield* decodeRevisionParams(params, "get_revision");
          return yield* getRevision(db, "post", slug, revId);
        }),
      ),
    ),
  )
  .post("/posts/:slug/restore", ({ body, params, request }) =>
    runWrite(
      request,
      withAuthor(request, ({ db, actor, adapterUrl }) =>
        Effect.gen(function* () {
          const { slug } = yield* decodeSlugParams(params, "restore_revision");
          const { revisionId } = yield* decodeRestoreInput(body, "restore_revision");
          return yield* restoreRevision(db, "post", slug, revisionId, actor, adapterUrl);
        }),
      ),
    ),
  )
  .get("/works/:slug/revisions", ({ params, request }) =>
    runWrite(
      request,
      withAuthor(request, ({ db }) =>
        Effect.gen(function* () {
          const { slug } = yield* decodeSlugParams(params, "list_revisions");
          return yield* listRevisions(db, "work", slug);
        }),
      ),
    ),
  )
  .get("/works/:slug/revisions/:revId", ({ params, request }) =>
    runWrite(
      request,
      withAuthor(request, ({ db }) =>
        Effect.gen(function* () {
          const { slug, revId } = yield* decodeRevisionParams(params, "get_revision");
          return yield* getRevision(db, "work", slug, revId);
        }),
      ),
    ),
  )
  .post("/works/:slug/restore", ({ body, params, request }) =>
    runWrite(
      request,
      withWorksAuthor(request, ({ db, actor, adapterUrl }) =>
        Effect.gen(function* () {
          const { slug } = yield* decodeSlugParams(params, "restore_revision");
          const { revisionId } = yield* decodeRestoreInput(body, "restore_revision");
          return yield* restoreRevision(db, "work", slug, revisionId, actor, adapterUrl);
        }),
      ),
    ),
  )
  .post("/categories", ({ body, request }) =>
    runWrite(
      request,
      withAuthor(request, ({ db }) =>
        Effect.gen(function* () {
          const input = yield* decodeBoundary(
            CmsCategoryInputSchema,
            body,
            "Invalid category body",
            "create_category",
          );
          return yield* createCategory(db, input);
        }),
      ),
    ),
  )
  .delete("/categories/:slug", ({ params, request }) =>
    runWrite(
      request,
      withAuthor(request, ({ db }) =>
        Effect.gen(function* () {
          const { slug } = yield* decodeSlugParams(params, "delete_category");
          return yield* deleteCategory(db, slug);
        }),
      ),
    ),
  )
  .post("/media", ({ body, request }) =>
    runWrite(
      request,
      withAuthor(request, ({ db, r2 }) =>
        Effect.gen(function* () {
          const upload = yield* decodeUploadBody(body, "create_media");
          return yield* createMedia(db, r2, upload);
        }),
      ),
    ),
  )
  .delete("/media/:id", ({ params, request }) =>
    runWrite(
      request,
      withAuthor(request, ({ db, r2 }) =>
        Effect.gen(function* () {
          const { id } = yield* decodeMediaParams(params, "delete_media");
          return yield* deleteMedia(db, r2, id);
        }),
      ),
    ),
  )
  .get("/media", ({ query, request }) =>
    runWrite(
      request,
      withAuthor(request, ({ db }) =>
        Effect.gen(function* () {
          const paging = yield* decodePagingQuery(query, "list_media");
          return yield* listMedia(db, paging);
        }),
      ),
    ),
  )
  .get("/media/:id/usage", ({ params, request }) =>
    runWrite(
      request,
      withAuthor(request, ({ db }) =>
        Effect.gen(function* () {
          const { id } = yield* decodeMediaParams(params, "get_media_usage");
          return yield* getMediaUsage(db, id);
        }),
      ),
    ),
  );

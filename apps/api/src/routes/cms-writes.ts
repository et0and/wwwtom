import { Elysia } from "elysia";
import { Effect, Option, Schema } from "effect";
import {
  CmsCategoryInputSchema,
  CmsPostInputSchema,
  CmsRestoreInputSchema,
  CmsWorkInputSchema,
} from "@tom/schemas/cms";
import type { CmsCategoryInput, CmsPostInput, CmsWorkInput } from "@tom/schemas/cms";
import { CmsError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import type { CmsD1Binding, CmsR2Binding } from "@tom/utils/services/config";
import { parseAdminEmails, readCloudflareEnv } from "@tom/utils/services/config";
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
    // The session comes from Better Auth (an I/O boundary), so decode the
    // email instead of narrowing it.
    const email = Schema.decodeUnknownOption(Schema.String)(author.user.email);
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
      adapterUrl: env.ADAPTER_URL ?? "http://localhost:8788",
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

/** Decode a JSON write body at the route boundary. */
const decodeInputBody = <A, I, B>(
  schema: Schema.Codec<A, I>,
  body: B,
  message: string,
  operation: string,
): Effect.Effect<A, CmsError> =>
  Schema.decodeUnknownEffect(schema)(body).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message,
          status: HttpStatus.BadRequest,
          operation,
          cause,
        }),
    ),
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
  Schema.decodeUnknownEffect(UploadFormSchema)(body).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message: "Missing upload file",
          status: HttpStatus.BadRequest,
          operation,
          cause,
        }),
    ),
    Effect.flatMap(({ file, alt, caption }) =>
      Effect.gen(function* () {
        if (file.size === 0) {
          return yield* failInput("Upload file is empty", operation);
        }
        if (file.size > MAX_UPLOAD_BYTES) {
          return yield* Effect.fail(
            new CmsError({
              message: "Upload file too large",
              status: HttpStatus.PayloadTooLarge,
              operation,
            }),
          );
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
      }),
    ),
  );

const runWrites = <A>(effect: Effect.Effect<A, CmsError>, request: Request): Promise<A> =>
  runEffect(effect, logContextFromRequest(request, "tom-api"));

const withAuthor = <A>(
  request: Request,
  use: (context: AuthorContext) => Effect.Effect<A, CmsError>,
): Effect.Effect<A, CmsError> => Effect.flatMap(requireAuthor(request), use);

/**
 * Sophie is a posts-only tenant: the editor hides works UI-side
 * (VITE_SOPHIE), and the Sophie-tenant API (TENANT=sophie, set in
 * infra/apps/api.run.ts) rejects /works/* writes server-side. Reads stay
 * served; unset TENANT keeps the legacy shared behavior.
 */
const requireWorksWritesAllowed = (request: Request): Effect.Effect<void, CmsError> =>
  Effect.gen(function* () {
    if (getRequestEnv(request).TENANT === "sophie") {
      return yield* new CmsError({
        message: "Works are not available on this tenant",
        status: HttpStatus.Forbidden,
        operation: "works_disabled",
      });
    }
  });

const withWorksAuthor = <A>(
  request: Request,
  use: (context: AuthorContext) => Effect.Effect<A, CmsError>,
): Effect.Effect<A, CmsError> =>
  Effect.flatMap(requireWorksWritesAllowed(request), () => withAuthor(request, use));

const decodePostInput = <B>(body: B, operation: string): Effect.Effect<CmsPostInput, CmsError> =>
  decodeInputBody(CmsPostInputSchema, body, "Invalid post body", operation);

const decodeWorkInput = <B>(body: B, operation: string): Effect.Effect<CmsWorkInput, CmsError> =>
  decodeInputBody(CmsWorkInputSchema, body, "Invalid work body", operation);

const decodeCategoryInput = <B>(
  body: B,
  operation: string,
): Effect.Effect<CmsCategoryInput, CmsError> =>
  decodeInputBody(CmsCategoryInputSchema, body, "Invalid category body", operation);

const CmsRevisionParamsSchema = Schema.Struct({ slug: Schema.String, revId: Schema.String });

/** Decode revision route params at the boundary (Elysia types them optional). */
const decodeRevisionParams = <P>(
  params: P,
  operation: string,
): Effect.Effect<{ readonly slug: string; readonly revId: string }, CmsError> =>
  Schema.decodeUnknownEffect(CmsRevisionParamsSchema)(params).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message: "Invalid revision parameter",
          status: HttpStatus.BadRequest,
          operation,
          cause,
        }),
    ),
  );

const decodeRestoreInput = <B>(
  body: B,
  operation: string,
): Effect.Effect<{ readonly revisionId: string }, CmsError> =>
  decodeInputBody(CmsRestoreInputSchema, body, "Invalid restore body", operation);

export const cmsWriteRoutes = new Elysia({ name: "cms-writes" })
  .post("/posts", ({ body, request }) =>
    runWrites(
      withAuthor(request, ({ db, actor, adapterUrl }) =>
        Effect.flatMap(decodePostInput(body, "create_post"), (input) =>
          createPost(db, input, actor, adapterUrl),
        ),
      ),
      request,
    ),
  )
  .put("/posts/:slug", ({ body, params, request }) =>
    runWrites(
      withAuthor(request, ({ db, actor, adapterUrl }) =>
        Effect.flatMap(decodeSlugParams(params, "update_post"), ({ slug }) =>
          Effect.flatMap(decodePostInput(body, "update_post"), (input) =>
            updatePost(db, slug, input, actor, adapterUrl),
          ),
        ),
      ),
      request,
    ),
  )
  .delete("/posts/:slug", ({ params, request }) =>
    runWrites(
      withAuthor(request, ({ db }) =>
        Effect.flatMap(decodeSlugParams(params, "delete_post"), ({ slug }) => deletePost(db, slug)),
      ),
      request,
    ),
  )
  .post("/works", ({ body, request }) =>
    runWrites(
      withWorksAuthor(request, ({ db, actor, adapterUrl }) =>
        Effect.flatMap(decodeWorkInput(body, "create_work"), (input) =>
          createWork(db, input, actor, adapterUrl),
        ),
      ),
      request,
    ),
  )
  .put("/works/:slug", ({ body, params, request }) =>
    runWrites(
      withWorksAuthor(request, ({ db, actor, adapterUrl }) =>
        Effect.flatMap(decodeSlugParams(params, "update_work"), ({ slug }) =>
          Effect.flatMap(decodeWorkInput(body, "update_work"), (input) =>
            updateWork(db, slug, input, actor, adapterUrl),
          ),
        ),
      ),
      request,
    ),
  )
  .delete("/works/:slug", ({ params, request }) =>
    runWrites(
      withWorksAuthor(request, ({ db }) =>
        Effect.flatMap(decodeSlugParams(params, "delete_work"), ({ slug }) => deleteWork(db, slug)),
      ),
      request,
    ),
  )
  .get("/posts/:slug/revisions", ({ params, request }) =>
    runWrites(
      withAuthor(request, ({ db }) =>
        Effect.flatMap(decodeSlugParams(params, "list_revisions"), ({ slug }) =>
          listRevisions(db, "post", slug),
        ),
      ),
      request,
    ),
  )
  .get("/posts/:slug/revisions/:revId", ({ params, request }) =>
    runWrites(
      withAuthor(request, ({ db }) =>
        Effect.flatMap(decodeRevisionParams(params, "get_revision"), ({ slug, revId }) =>
          getRevision(db, "post", slug, revId),
        ),
      ),
      request,
    ),
  )
  .post("/posts/:slug/restore", ({ body, params, request }) =>
    runWrites(
      withAuthor(request, ({ db, actor, adapterUrl }) =>
        Effect.flatMap(decodeSlugParams(params, "restore_revision"), ({ slug }) =>
          Effect.flatMap(decodeRestoreInput(body, "restore_revision"), ({ revisionId }) =>
            restoreRevision(db, "post", slug, revisionId, actor, adapterUrl),
          ),
        ),
      ),
      request,
    ),
  )
  .get("/works/:slug/revisions", ({ params, request }) =>
    runWrites(
      withAuthor(request, ({ db }) =>
        Effect.flatMap(decodeSlugParams(params, "list_revisions"), ({ slug }) =>
          listRevisions(db, "work", slug),
        ),
      ),
      request,
    ),
  )
  .get("/works/:slug/revisions/:revId", ({ params, request }) =>
    runWrites(
      withAuthor(request, ({ db }) =>
        Effect.flatMap(decodeRevisionParams(params, "get_revision"), ({ slug, revId }) =>
          getRevision(db, "work", slug, revId),
        ),
      ),
      request,
    ),
  )
  .post("/works/:slug/restore", ({ body, params, request }) =>
    runWrites(
      withWorksAuthor(request, ({ db, actor, adapterUrl }) =>
        Effect.flatMap(decodeSlugParams(params, "restore_revision"), ({ slug }) =>
          Effect.flatMap(decodeRestoreInput(body, "restore_revision"), ({ revisionId }) =>
            restoreRevision(db, "work", slug, revisionId, actor, adapterUrl),
          ),
        ),
      ),
      request,
    ),
  )
  .post("/categories", ({ body, request }) =>
    runWrites(
      withAuthor(request, ({ db }) =>
        Effect.flatMap(decodeCategoryInput(body, "create_category"), (input) =>
          createCategory(db, input),
        ),
      ),
      request,
    ),
  )
  .delete("/categories/:slug", ({ params, request }) =>
    runWrites(
      withAuthor(request, ({ db }) =>
        Effect.flatMap(decodeSlugParams(params, "delete_category"), ({ slug }) =>
          deleteCategory(db, slug),
        ),
      ),
      request,
    ),
  )
  .post("/media", ({ body, request }) =>
    runWrites(
      withAuthor(request, ({ db, r2 }) =>
        Effect.flatMap(decodeUploadBody(body, "create_media"), (upload) =>
          createMedia(db, r2, upload),
        ),
      ),
      request,
    ),
  )
  .delete("/media/:id", ({ params, request }) =>
    runWrites(
      withAuthor(request, ({ db, r2 }) =>
        Effect.flatMap(decodeMediaParams(params, "delete_media"), ({ id }) =>
          deleteMedia(db, r2, id),
        ),
      ),
      request,
    ),
  )
  .get("/media", ({ query, request }) =>
    runWrites(
      withAuthor(request, ({ db }) =>
        Effect.flatMap(decodePagingQuery(query, "list_media"), (paging) => listMedia(db, paging)),
      ),
      request,
    ),
  )
  .get("/media/:id/usage", ({ params, request }) =>
    runWrites(
      withAuthor(request, ({ db }) =>
        Effect.flatMap(decodeMediaParams(params, "get_media_usage"), ({ id }) =>
          getMediaUsage(db, id),
        ),
      ),
      request,
    ),
  );

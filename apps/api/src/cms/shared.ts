import { Effect, Option, Schema } from "effect";
import { CmsPagingSchema, CmsRestoreInputSchema } from "@tom/schemas/cms";
import type { CmsListResponse, CmsPaging, CmsStatusFilter } from "@tom/schemas/cms";
import { CmsError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import type { CmsD1Binding, CmsR2Binding, CloudflareEnv } from "@tom/utils/config";
import { readCloudflareEnv, tenantFromValue } from "@tom/utils/config";
import { parseCommaSeparated } from "@tom/schemas/env";
import { hasSessionCredential } from "@tom/utils/session";
import { workerCache } from "@tom/utils/http";
import { getRequestEnv, logContextFromRequest, runEffect } from "@tom/utils/worker";
import { toOpenApiSchema } from "../openapi";
import { createAuthFromEnv, isAdminEmail, requireSession } from "../auth/operations";
import type { MediaUpload } from "./operations";

export const cmsListQuerySchema = toOpenApiSchema(CmsPagingSchema);

const CmsSlugParamsSchema = Schema.Struct({ slug: Schema.String });

export const cmsSlugParamsSchema = toOpenApiSchema(CmsSlugParamsSchema);

const CmsMediaParamsSchema = Schema.Struct({ id: Schema.String });

export const cmsMediaParamsSchema = toOpenApiSchema(CmsMediaParamsSchema);

const CmsRevisionParamsSchema = Schema.Struct({ slug: Schema.String, revId: Schema.String });

/** Decode Elysia input at the route boundary; invalid input maps to 400. */
export const decodeBoundary = <A, I, B>(
  schema: Schema.Codec<A, I>,
  input: B,
  message: string,
  operation: string,
): Effect.Effect<A, CmsError> =>
  Schema.decodeUnknownEffect(schema)(input).pipe(
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

/** Decode Elysia query input into paging at the route boundary. */
export const decodePagingQuery = <Q>(
  query: Q,
  operation: string,
): Effect.Effect<CmsPaging, CmsError> =>
  decodeBoundary(CmsPagingSchema, query, "Invalid paging parameters", operation);

/** Decode Elysia route params at the boundary (Elysia types them optional). */
export const decodeSlugParams = <P>(
  params: P,
  operation: string,
): Effect.Effect<{ readonly slug: string }, CmsError> =>
  decodeBoundary(CmsSlugParamsSchema, params, "Invalid slug parameter", operation);

export const decodeMediaParams = <P>(
  params: P,
  operation: string,
): Effect.Effect<{ readonly id: string }, CmsError> =>
  decodeBoundary(CmsMediaParamsSchema, params, "Invalid media id parameter", operation);

/** Decode revision route params at the boundary (Elysia types them optional). */
export const decodeRevisionParams = <P>(
  params: P,
  operation: string,
): Effect.Effect<{ readonly slug: string; readonly revId: string }, CmsError> =>
  decodeBoundary(CmsRevisionParamsSchema, params, "Invalid revision parameter", operation);

const decodeRestoreInput = <B>(
  body: B,
  operation: string,
): Effect.Effect<{ readonly revisionId: string }, CmsError> =>
  decodeBoundary(CmsRestoreInputSchema, body, "Invalid restore body", operation);

/**
 * Fail closed when a CMS storage binding is missing. `Option` does the
 * narrowing, so the non-null binding is a type-level fact rather than an
 * assertion the caller has to trust.
 */
const requireBinding = <B>(
  binding: B | undefined,
  message: string,
  operation: string,
): Effect.Effect<NonNullable<B>, CmsError> =>
  Effect.fromOption(
    Option.fromNullishOr(binding),
    () =>
      new CmsError({
        message,
        status: HttpStatus.InternalServerError,
        operation,
      }),
  );

/** Fail closed when the CMS D1 binding is missing. */
export const requireCmsD1 = (env: CloudflareEnv): Effect.Effect<CmsD1Binding, CmsError> =>
  requireBinding(env.CMS_D1, "CMS storage not configured", "require_cms_d1");
/** Fail closed when the CMS media bucket binding is missing. */
export const requireCmsR2 = (env: CloudflareEnv): Effect.Effect<CmsR2Binding, CmsError> =>
  requireBinding(env.CMS_MEDIA, "CMS media storage not configured", "require_cms_r2");

/**
 * Worker Cache API for hot media bytes. Edge CDN caching covers
 * production via Cache-Control; this shields R2 on dev/preview hosts and
 * absorbs repeat hits in-worker. Absent outside Workers (tests) — skip.
 * Best-effort: cache failures fall through to R2, never 500.
 */
export const matchFileCache = (url: string): Effect.Effect<Response | undefined, never> =>
  Effect.tryPromise({
    try: async () => (await workerCache()?.match(url)) ?? undefined,
    catch: () => undefined,
  }).pipe(Effect.orElseSucceed(() => undefined));

export const putFileCache = (url: string, response: Response): Effect.Effect<void, never> =>
  Effect.ignore(
    Effect.tryPromise({
      try: async () => {
        await workerCache()?.put(url, response.clone());
      },
      catch: () => undefined,
    }),
  );

/**
 * Best-effort admin check for reads: a live session unlocks drafts,
 * anything else falls back to published-only. Never fails, so anonymous
 * readers never see auth errors. Resolve the env first: production keeps
 * BETTER_AUTH_SECRET and the provider keys in the TOM_SECRETS bundle, so
 * the raw worker env cannot build an auth instance. Fast-path: without a
 * session credential (see hasSessionCredential) there is no session to
 * load, so skip the store read, auth init and the D1 lookup entirely —
 * public reads stay at 2-3 D1 queries instead of 3-4.
 */
export const optionalSession = (
  request: Request,
  env: CloudflareEnv,
): Effect.Effect<boolean, never> => {
  if (!hasSessionCredential(request)) return Effect.succeed(false);
  return Effect.gen(function* () {
    const auth = yield* Effect.gen(function* () {
      const resolved = yield* Effect.tryPromise({
        try: () => readCloudflareEnv(env),
        catch: (cause) =>
          new CmsError({
            message: "Failed to read Cloudflare env for CMS read auth",
            status: HttpStatus.InternalServerError,
            operation: "optional_session",
            cause,
          }),
      });
      return yield* createAuthFromEnv(resolved);
    }).pipe(
      Effect.tapError((cause) =>
        Effect.logWarning("CMS read auth unavailable; serving published-only", {
          cause: String(cause),
        }),
      ),
    );
    yield* requireSession(auth, request.headers);
    return true;
  }).pipe(Effect.orElseSucceed(() => false));
};

/** Run a CMS effect with request logging. CmsError failures reject and the
 * worker onError hook maps them to RFC 9457 problem responses, so route
 * return types stay precise for treaty clients. */
export const runCms = <A>(effect: Effect.Effect<A, CmsError>, request: Request): Promise<A> =>
  runEffect(effect, logContextFromRequest(request, "tom-api"));

/** Run a CMS read needing D1 with request logging. */
export const withCms = <A>(
  request: Request,
  use: (db: CmsD1Binding) => Effect.Effect<A, CmsError>,
): Promise<A> => {
  const env = getRequestEnv(request);
  return runCms(
    Effect.gen(function* () {
      const db = yield* requireCmsD1(env);
      return yield* use(db);
    }),
    request,
  );
};

/**
 * List status for the caller: a verified session (author) gets the
 * requested selector, defaulting to all; public readers always get
 * published. A draft selector without a session fails 401 instead of
 * narrowing to published rows, so a broken session can never look like an
 * empty CMS list.
 */
const listStatus = (
  requested: CmsStatusFilter | undefined,
  hasSession: boolean,
  operation: string,
): Effect.Effect<CmsStatusFilter, CmsError> => {
  if (hasSession) return Effect.succeed(requested ?? "all");
  if (requested === undefined || requested === "published") return Effect.succeed("published");
  return Effect.fail(
    new CmsError({
      message: "Sign in to read drafts",
      status: HttpStatus.Unauthorized,
      operation,
    }),
  );
};

/**
 * Shared list pipeline: storage gate, paging decode, admin check, then the
 * service list fn. Works have no categories, so their routes reject the
 * filter instead of silently ignoring it.
 */
export const runListQuery = <T, Q>(
  request: Request,
  query: Q,
  operation: string,
  allowCategory: boolean,
  list: (
    db: CmsD1Binding,
    paging: CmsPaging,
    status: CmsStatusFilter,
  ) => Effect.Effect<CmsListResponse<T>, CmsError>,
): Promise<CmsListResponse<T>> => {
  const env = getRequestEnv(request);
  return runCms(
    Effect.gen(function* () {
      const db = yield* requireCmsD1(env);
      const paging = yield* decodePagingQuery(query, operation);
      if (
        !allowCategory &&
        (paging.category !== undefined || paging.excludeCategory !== undefined)
      ) {
        return yield* new CmsError({
          message: "Category filter not supported for works",
          status: HttpStatus.BadRequest,
          operation,
        });
      }
      const hasSession = yield* optionalSession(request, env);
      const status = yield* listStatus(paging.status, hasSession, operation);
      return yield* list(db, paging, status);
    }),
    request,
  );
};

export type AuthorContext = {
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
export const requireAuthor = (request: Request): Effect.Effect<AuthorContext, CmsError> =>
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
      !isAdminEmail(email.value, parseCommaSeparated(env.CMS_ADMIN_EMAILS))
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

export const failInput = (message: string, operation: string): Effect.Effect<never, CmsError> =>
  Effect.fail(
    new CmsError({
      message,
      status: HttpStatus.BadRequest,
      operation,
    }),
  );

export const withAuthor = <A>(
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
export const requireWorksWritesAllowed = (request: Request): Effect.Effect<void, CmsError> =>
  tenantFromValue(getRequestEnv(request).TENANT) === "sophie"
    ? Effect.fail(
        new CmsError({
          message: "Works are not available on this tenant",
          status: HttpStatus.Forbidden,
          operation: "works_disabled",
        }),
      )
    : Effect.void;

export const withWorksAuthor = <A>(
  request: Request,
  use: (context: AuthorContext) => Effect.Effect<A, CmsError>,
): Effect.Effect<A, CmsError> =>
  Effect.gen(function* () {
    yield* requireWorksWritesAllowed(request);
    return yield* withAuthor(request, use);
  });

export const runWrite = <A>(request: Request, effect: Effect.Effect<A, CmsError>): Promise<A> =>
  runEffect(effect, logContextFromRequest(request, "tom-api"));

export { decodeRestoreInput };

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
export const decodeUploadBody = <B>(
  body: B,
  operation: string,
): Effect.Effect<MediaUpload, CmsError> =>
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

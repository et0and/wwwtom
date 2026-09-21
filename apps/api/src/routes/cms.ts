import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { CmsPagingSchema } from "@tom/schemas/cms";
import type { CmsListResponse, CmsPaging, CmsStatusFilter } from "@tom/schemas/cms";
import { CmsError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import type { CmsD1Binding, CmsR2Binding, CloudflareEnv } from "@tom/utils/services/config";
import { readCloudflareEnv } from "@tom/utils/services/config";
import { hasSessionCredential } from "@tom/utils/services/session";
import { workerCache } from "@tom/utils/services/http";
import { getRequestEnv, logContextFromRequest, runEffect } from "@tom/utils/services/worker";
import { toOpenApiSchema } from "../openapi";
import { createAuthFromEnv, requireSession } from "../services/auth";
import {
  getMediaById,
  getMediaFile,
  getPostBySlug,
  getWorkBySlug,
  listCategories,
  listPostSummaries,
  listPosts,
  listWorkSummaries,
  listWorks,
} from "../services/cms";

const cmsListQuerySchema = toOpenApiSchema(CmsPagingSchema);

const CmsSlugParamsSchema = Schema.Struct({ slug: Schema.String });

const cmsSlugParamsSchema = toOpenApiSchema(CmsSlugParamsSchema);

const CmsMediaParamsSchema = Schema.Struct({ id: Schema.String });

const cmsMediaParamsSchema = toOpenApiSchema(CmsMediaParamsSchema);

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

/** Fail closed when a CMS storage binding is missing. */
const requireBinding = <B>(
  binding: B | undefined,
  message: string,
  operation: string,
): Effect.Effect<NonNullable<B>, CmsError> =>
  binding
    ? Effect.succeed(binding as NonNullable<B>)
    : Effect.fail(
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
const matchFileCache = (url: string): Effect.Effect<Response | undefined, never> =>
  Effect.tryPromise({
    try: async () => (await workerCache()?.match(url)) ?? undefined,
    catch: () => undefined,
  }).pipe(Effect.orElseSucceed(() => undefined));

const putFileCache = (url: string, response: Response): Effect.Effect<void, never> =>
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
const optionalSession = (request: Request, env: CloudflareEnv): Effect.Effect<boolean, never> => {
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
const runCms = <A>(effect: Effect.Effect<A, CmsError>, request: Request): Promise<A> =>
  runEffect(effect, logContextFromRequest(request, "tom-api"));

/** Run a CMS read needing D1 with request logging. */
const withCms = <A>(
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
const runListQuery = <T, Q>(
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

export const cmsRoutes = new Elysia({ name: "cms" })
  .get(
    "/posts",
    ({ query, request }) => runListQuery(request, query, "list_posts", true, listPosts),
    {
      query: cmsListQuerySchema,
      detail: { description: "List posts (drafts need a session)", tags: ["cms"] },
    },
  )
  .get(
    // Static before dynamic: "/posts/summary" must not read as a slug.
    "/posts/summary",
    ({ query, request }) =>
      runListQuery(request, query, "list_post_summaries", true, listPostSummaries),
    {
      query: cmsListQuerySchema,
      detail: {
        description: "List post summaries, no body (drafts need a session)",
        tags: ["cms"],
      },
    },
  )
  .get(
    "/posts/:slug",
    ({ params, request }) =>
      withCms(request, (db) =>
        Effect.gen(function* () {
          const { slug } = yield* decodeSlugParams(params, "get_post");
          const isAdmin = yield* optionalSession(request, getRequestEnv(request));
          return yield* getPostBySlug(db, slug, isAdmin ? "all" : "published");
        }),
      ),
    {
      params: cmsSlugParamsSchema,
      detail: { description: "Get a post by slug (drafts need a session)", tags: ["cms"] },
    },
  )
  .get(
    "/works",
    ({ query, request }) => runListQuery(request, query, "list_works", false, listWorks),
    {
      query: cmsListQuerySchema,
      detail: { description: "List works (drafts need a session)", tags: ["cms"] },
    },
  )
  .get(
    // Static before dynamic: "/works/summary" must not read as a slug.
    "/works/summary",
    ({ query, request }) =>
      runListQuery(request, query, "list_work_summaries", false, listWorkSummaries),
    {
      query: cmsListQuerySchema,
      detail: {
        description: "List work summaries, no body (drafts need a session)",
        tags: ["cms"],
      },
    },
  )
  .get(
    "/works/:slug",
    ({ params, request }) =>
      withCms(request, (db) =>
        Effect.gen(function* () {
          const { slug } = yield* decodeSlugParams(params, "get_work");
          const isAdmin = yield* optionalSession(request, getRequestEnv(request));
          return yield* getWorkBySlug(db, slug, isAdmin ? "all" : "published");
        }),
      ),
    {
      params: cmsSlugParamsSchema,
      detail: { description: "Get a work by slug (drafts need a session)", tags: ["cms"] },
    },
  )
  .get("/categories", ({ request }) => withCms(request, (db) => listCategories(db)), {
    detail: { description: "List categories", tags: ["cms"] },
  })
  .get(
    "/media/:id",
    ({ params, request }) =>
      withCms(request, (db) =>
        Effect.gen(function* () {
          const { id } = yield* decodeMediaParams(params, "get_media");
          return yield* getMediaById(db, id);
        }),
      ),
    {
      params: cmsMediaParamsSchema,
      detail: { description: "Get media metadata by id", tags: ["cms"] },
    },
  )
  .get(
    "/media/:id/file",
    ({ params, request }) => {
      const env = getRequestEnv(request);
      return runCms(
        matchFileCache(request.url).pipe(
          Effect.filterOrElse(
            (cached): cached is Response => cached !== undefined,
            () =>
              Effect.gen(function* () {
                const db = yield* requireCmsD1(env);
                const r2 = yield* requireCmsR2(env);
                const { id } = yield* decodeMediaParams(params, "get_media_file");
                const { mime, object } = yield* getMediaFile(db, r2, id);
                // Buffered, not streamed: the best-effort workerCache write
                // below clones the response, and a tee buffers the whole body
                // anyway, so streaming would add complexity without a memory win.
                const bytes = yield* Effect.tryPromise({
                  try: () => object.arrayBuffer(),
                  catch: (cause) =>
                    new CmsError({
                      message: "Media read failed",
                      status: HttpStatus.InternalServerError,
                      operation: "get_media_file",
                      cause,
                    }),
                });
                const response = new Response(bytes, {
                  headers: {
                    "Content-Type": mime,
                    "Cache-Control": "public, max-age=31536000, immutable",
                    // Served bytes are renderer-trusted images/video.
                    // nosniff stops MIME-sniffing; sandbox stops a
                    // smuggled script from executing top-level (this
                    // also protects pre-existing SVG rows).
                    "X-Content-Type-Options": "nosniff",
                    "Content-Security-Policy": "sandbox",
                  },
                });
                yield* putFileCache(request.url, response);
                return response;
              }),
          ),
        ),
        request,
      );
    },
    {
      params: cmsMediaParamsSchema,
      detail: { description: "Serve media file bytes by id", tags: ["cms"] },
    },
  );

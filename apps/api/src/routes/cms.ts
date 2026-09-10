import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { CmsPagingSchema } from "@tom/schemas/cms";
import type { CmsListResponse, CmsPaging, CmsStatusFilter } from "@tom/schemas/cms";
import { CmsError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import type { CmsD1Binding, CmsR2Binding, CloudflareEnv } from "@tom/utils/services/config";
import { hasSessionCredential } from "@tom/utils/services/session";
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

/** Decode Elysia query input into paging at the route boundary. */
export const decodePagingQuery = <Q>(
  query: Q,
  operation: string,
): Effect.Effect<CmsPaging, CmsError> =>
  Schema.decodeUnknownEffect(CmsPagingSchema)(query).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message: "Invalid paging parameters",
          status: HttpStatus.BadRequest,
          operation,
          cause,
        }),
    ),
  );

/** Decode Elysia route params at the boundary (Elysia types them optional). */
export const decodeSlugParams = <P>(
  params: P,
  operation: string,
): Effect.Effect<{ readonly slug: string }, CmsError> =>
  Schema.decodeUnknownEffect(CmsSlugParamsSchema)(params).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message: "Invalid slug parameter",
          status: HttpStatus.BadRequest,
          operation,
          cause,
        }),
    ),
  );

export const decodeMediaParams = <P>(
  params: P,
  operation: string,
): Effect.Effect<{ readonly id: string }, CmsError> =>
  Schema.decodeUnknownEffect(CmsMediaParamsSchema)(params).pipe(
    Effect.mapError(
      (cause) =>
        new CmsError({
          message: "Invalid media id parameter",
          status: HttpStatus.BadRequest,
          operation,
          cause,
        }),
    ),
  );

/** Fail closed when the CMS D1 binding is missing. */
export const requireCmsD1 = (env: CloudflareEnv): Effect.Effect<CmsD1Binding, CmsError> =>
  env.CMS_D1
    ? Effect.succeed(env.CMS_D1)
    : Effect.fail(
        new CmsError({
          message: "CMS storage not configured",
          status: HttpStatus.InternalServerError,
          operation: "require_cms_d1",
        }),
      );
/** Fail closed when the CMS media bucket binding is missing. */
export const requireCmsR2 = (env: CloudflareEnv): Effect.Effect<CmsR2Binding, CmsError> =>
  env.CMS_MEDIA
    ? Effect.succeed(env.CMS_MEDIA)
    : Effect.fail(
        new CmsError({
          message: "CMS media storage not configured",
          status: HttpStatus.InternalServerError,
          operation: "require_cms_r2",
        }),
      );

/**
 * Worker Cache API for hot media bytes. Edge CDN caching covers
 * production via Cache-Control; this shields R2 on dev/preview hosts and
 * absorbs repeat hits in-worker. Absent outside Workers (tests) — skip.
 * Best-effort: cache failures fall through to R2, never 500.
 */
type DefaultCache = {
  readonly match: (key: string) => Promise<Response | undefined>;
  readonly put: (key: string, response: Response) => Promise<void>;
};

type CacheScope = { readonly caches?: { readonly default?: DefaultCache } };

/**
 * `caches.default` is a Workers extension missing from the DOM type, so
 * reach it through a narrow structural view. Undefined outside Workers
 * (tests) — callers skip caching then.
 */
const defaultCache = (): DefaultCache | undefined => (globalThis as CacheScope).caches?.default;

const matchFileCache = (url: string): Effect.Effect<Response | undefined, never> =>
  Effect.tryPromise({
    try: async () => (await defaultCache()?.match(url)) ?? undefined,
    catch: () => undefined,
  }).pipe(Effect.orElseSucceed(() => undefined));

const putFileCache = (url: string, response: Response): Effect.Effect<void, never> =>
  Effect.ignore(
    Effect.tryPromise({
      try: async () => {
        await defaultCache()?.put(url, response.clone());
      },
      catch: () => undefined,
    }),
  );

/**
 * Best-effort admin check for reads: a live session unlocks drafts,
 * anything else falls back to published-only. Never fails, so anonymous
 * readers never see auth errors. Fast-path: without a session credential
 * (see hasSessionCredential) there is no session to load, so skip auth
 * init and the D1 lookup entirely — public reads stay at 2-3 D1 queries
 * instead of 3-4.
 */
const optionalSession = (request: Request, env: CloudflareEnv): Effect.Effect<boolean, never> => {
  if (!hasSessionCredential(request)) return Effect.succeed(false);
  return createAuthFromEnv(env).pipe(
    Effect.flatMap((auth) => requireSession(auth, request.headers)),
    Effect.as(true),
    Effect.orElseSucceed(() => false),
  );
};

/** Run a CMS effect with request logging. CmsError failures reject and the
 * worker onError hook maps them to RFC 9457 problem responses, so route
 * return types stay precise for treaty clients. */
const runCms = <A>(effect: Effect.Effect<A, CmsError>, request: Request): Promise<A> =>
  runEffect(effect, logContextFromRequest(request, "tom-api"));

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
    requireCmsD1(env).pipe(
      Effect.flatMap((db) =>
        Effect.flatMap(decodePagingQuery(query, operation), (paging) =>
          !allowCategory && (paging.category !== undefined || paging.excludeCategory !== undefined)
            ? Effect.fail(
                new CmsError({
                  message: "Category filter not supported for works",
                  status: HttpStatus.BadRequest,
                  operation,
                }),
              )
            : Effect.flatMap(optionalSession(request, env), (isAdmin) =>
                list(db, paging, isAdmin ? (paging.status ?? "all") : "published"),
              ),
        ),
      ),
    ),
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
    ({ params, request }) => {
      const env = getRequestEnv(request);
      return runCms(
        requireCmsD1(env).pipe(
          Effect.flatMap((db) =>
            Effect.flatMap(decodeSlugParams(params, "get_post"), ({ slug }) =>
              Effect.flatMap(optionalSession(request, env), (isAdmin) =>
                getPostBySlug(db, slug, isAdmin ? "all" : "published"),
              ),
            ),
          ),
        ),
        request,
      );
    },
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
    ({ params, request }) => {
      const env = getRequestEnv(request);
      return runCms(
        requireCmsD1(env).pipe(
          Effect.flatMap((db) =>
            Effect.flatMap(decodeSlugParams(params, "get_work"), ({ slug }) =>
              Effect.flatMap(optionalSession(request, env), (isAdmin) =>
                getWorkBySlug(db, slug, isAdmin ? "all" : "published"),
              ),
            ),
          ),
        ),
        request,
      );
    },
    {
      params: cmsSlugParamsSchema,
      detail: { description: "Get a work by slug (drafts need a session)", tags: ["cms"] },
    },
  )
  .get(
    "/categories",
    ({ request }) => {
      const env = getRequestEnv(request);
      return runCms(requireCmsD1(env).pipe(Effect.flatMap((db) => listCategories(db))), request);
    },
    {
      detail: { description: "List categories", tags: ["cms"] },
    },
  )
  .get(
    "/media/:id",
    ({ params, request }) => {
      const env = getRequestEnv(request);
      return runCms(
        requireCmsD1(env).pipe(
          Effect.flatMap((db) =>
            Effect.flatMap(decodeMediaParams(params, "get_media"), ({ id }) =>
              getMediaById(db, id),
            ),
          ),
        ),
        request,
      );
    },
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
        Effect.flatMap(matchFileCache(request.url), (cached) => {
          if (cached !== undefined) return Effect.succeed(cached);
          return requireCmsD1(env).pipe(
            Effect.flatMap((db) =>
              Effect.flatMap(requireCmsR2(env), (r2) =>
                Effect.flatMap(decodeMediaParams(params, "get_media_file"), ({ id }) =>
                  getMediaFile(db, r2, id),
                ),
              ),
            ),
            Effect.flatMap(({ mime, object }) =>
              Effect.tryPromise({
                try: () => object.arrayBuffer(),
                catch: (cause) =>
                  new CmsError({
                    message: "Media read failed",
                    status: HttpStatus.InternalServerError,
                    operation: "get_media_file",
                    cause,
                  }),
              }).pipe(
                Effect.map(
                  (bytes) =>
                    new Response(bytes, {
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
                    }),
                ),
                Effect.tap((response) => putFileCache(request.url, response)),
              ),
            ),
          );
        }),
        request,
      );
    },
    {
      params: cmsMediaParamsSchema,
      detail: { description: "Serve media file bytes by id", tags: ["cms"] },
    },
  );

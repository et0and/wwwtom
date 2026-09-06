import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { CmsPagingSchema } from "@tom/schemas/cms";
import type { CmsPaging } from "@tom/schemas/cms";
import { CmsError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import type { CmsD1Binding, CmsR2Binding, CloudflareEnv } from "@tom/utils/services/config";
import { getRequestEnv, logContextFromRequest, runEffect } from "@tom/utils/services/worker";
import { toOpenApiSchema } from "../openapi";
import { createAuthFromEnv, requireSession } from "../services/auth";
import {
  getMediaById,
  getMediaFile,
  getPostBySlug,
  getWorkBySlug,
  listCategories,
  listPosts,
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
 * Best-effort admin check for reads: a live session unlocks drafts,
 * anything else falls back to published-only. Never fails, so anonymous
 * readers never see auth errors.
 */
const optionalSession = (request: Request, env: CloudflareEnv): Effect.Effect<boolean, never> =>
  createAuthFromEnv(env).pipe(
    Effect.flatMap((auth) => requireSession(auth, request.headers)),
    Effect.as(true),
    Effect.orElseSucceed(() => false),
  );

/** Run a CMS effect with request logging. CmsError failures reject and the
 * worker onError hook maps them to RFC 9457 problem responses, so route
 * return types stay precise for treaty clients. */
const runCms = <A>(effect: Effect.Effect<A, CmsError>, request: Request): Promise<A> =>
  runEffect(effect, logContextFromRequest(request, "tom-api"));

export const cmsRoutes = new Elysia({ name: "cms" })
  .get(
    "/posts",
    ({ query, request }) => {
      const env = getRequestEnv(request);
      return runCms(
        requireCmsD1(env).pipe(
          Effect.flatMap((db) =>
            Effect.flatMap(decodePagingQuery(query, "list_posts"), (paging) =>
              Effect.flatMap(optionalSession(request, env), (isAdmin) =>
                listPosts(db, paging, isAdmin ? (paging.status ?? "all") : "published"),
              ),
            ),
          ),
        ),
        request,
      );
    },
    {
      query: cmsListQuerySchema,
      detail: { description: "List posts (drafts need a session)", tags: ["cms"] },
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
    ({ query, request }) => {
      const env = getRequestEnv(request);
      return runCms(
        requireCmsD1(env).pipe(
          Effect.flatMap((db) =>
            Effect.flatMap(decodePagingQuery(query, "list_works"), (paging) =>
              Effect.flatMap(optionalSession(request, env), (isAdmin) =>
                listWorks(db, paging, isAdmin ? (paging.status ?? "all") : "published"),
              ),
            ),
          ),
        ),
        request,
      );
    },
    {
      query: cmsListQuerySchema,
      detail: { description: "List works (drafts need a session)", tags: ["cms"] },
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
        requireCmsD1(env).pipe(
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
                    },
                  }),
              ),
            ),
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

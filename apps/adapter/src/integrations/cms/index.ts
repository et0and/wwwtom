import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import {
  CmsPagingSchema,
  type ArenaRef,
  type CmsPost,
  type CmsSlug,
  type CmsStatusFilter,
  type TiptapBlock,
  type TiptapDoc,
} from "@tom/schemas/cms";
import { HttpStatus, isErrorStatus } from "@tom/constants/http";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import { readCloudflareEnv } from "@tom/utils/services/config";
import { getRequestEnv, logContextFromRequest } from "@tom/utils/services/worker";
import type { LogContext } from "@tom/utils/services/logging";
import { callApi } from "../../callApi";
import { AdapterError, runAdapter } from "../../config/effect";
import { allowLocalOriginsForAdapter, tenantFromValue } from "../../origins";
import { forwardHeaders, toProxiedResponse } from "../auth";
import { requireTrustedWriteOrigin, type WriteOriginGateOptions } from "../write-origin-gate";
import { simulatorEnv } from "../../simulator";
import { setPublicContentCache } from "../content-cache";

type TreatyCall<T> = Promise<{
  readonly data: T | null;
  readonly error: unknown;
  readonly status: number;
}>;

/**
 * Forward a treaty call to the CMS API and unwrap the JSON body. Treaty
 * errors become AdapterErrors so the global onError hook maps them to RFC
 * 9457 problem responses (and alerts on 5xx).
 */
const proxyCms = <T>(call: TreatyCall<T>, resource: string, context: LogContext): Promise<T> =>
  runAdapter(
    Effect.tryPromise({
      try: () => call,
      catch: () =>
        new AdapterError({
          status: HttpStatus.BadGateway,
          message: `CMS ${resource} unavailable`,
        }),
    }).pipe(
      Effect.flatMap((result) =>
        result.error === null && result.data !== null
          ? Effect.succeed(result.data)
          : Effect.fail(
              new AdapterError({
                status: isErrorStatus(result.status)
                  ? result.status
                  : HttpStatus.InternalServerError,
                message:
                  result.status === HttpStatus.NotFound
                    ? `CMS ${resource} not found`
                    : `CMS ${resource} request failed`,
              }),
            ),
      ),
    ),
    (error) => error,
    context,
  );

const cmsApi = async (request: Request) => {
  const env = simulatorEnv(await readCloudflareEnv(getRequestEnv(request)), request);
  return {
    api: callApi(env.API_URL ?? LOCAL_SERVICE_URLS.api),
    apiUrl: env.API_URL ?? LOCAL_SERVICE_URLS.api,
    adapterOrigin: env.ADAPTER_URL ?? LOCAL_SERVICE_URLS.adapter,
    token: env.INTERNAL_API_TOKEN,
    context: logContextFromRequest(request, "tom-adapter"),
  };
};

/** List page sizes mirror the index pages that consume them. */
const POSTS_PAGE_SIZE = 5;
const WORKS_PAGE_SIZE = 10;

type CmsApi = Awaited<ReturnType<typeof cmsApi>>["api"];

/**
 * Proxy a public CMS read, then mark it cacheable. The cache headers go on
 * after the upstream succeeds so 404/500 problem responses never store at
 * the edge (a fresh slug would 404 for the whole s-maxage otherwise).
 */
const proxyCachedCms = async <T>(
  request: Request,
  set: { headers: Record<string, string | number> },
  resource: string,
  call: (api: CmsApi) => TreatyCall<T>,
): Promise<T> => {
  const { api, context } = await cmsApi(request);
  const data = await proxyCms(call(api), resource, context);
  setPublicContentCache(request, set);
  return data;
};

/**
 * CSRF gate for CMS writes. Session cookies travel cross-site
 * (SameSite=None), and multipart POSTs are CORS-safelisted, so the proxy
 * itself verifies the request came from a trusted page.
 */
const writeOriginOptions = (request: Request, adapterOrigin: string): WriteOriginGateOptions => {
  const env = getRequestEnv(request);
  return {
    adapterOrigin,
    allowLocalOrigins: allowLocalOriginsForAdapter(env.ADAPTER_URL),
    tenant: tenantFromValue(env.TENANT),
    exemptSafeMethods: false,
    message: "Untrusted write origin",
  };
};

/**
 * Transparent proxy for CMS writes (`/content/*` → API same path). Bodies
 * are buffered (editor payloads and uploads are small) so multipart uploads
 * survive the hop byte-for-byte; upstream statuses pass through as-is.
 */
const proxyWrite = (
  request: Request,
  apiUrl: string,
  adapterOrigin: string,
  token: string | undefined,
  context: LogContext,
) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/content/, "");
  return runAdapter(
    Effect.gen(function* () {
      yield* requireTrustedWriteOrigin(request, writeOriginOptions(request, adapterOrigin));
      const body = yield* Effect.tryPromise({
        try: () => request.arrayBuffer(),
        catch: () =>
          new AdapterError({
            status: HttpStatus.BadRequest,
            message: "Unreadable CMS request",
          }),
      });
      const upstream = yield* Effect.tryPromise({
        try: () =>
          fetch(`${apiUrl}${path}${url.search}`, {
            method: request.method,
            headers: forwardHeaders(request.headers, token),
            body,
            redirect: "manual",
          }),
        catch: () =>
          new AdapterError({
            status: HttpStatus.BadGateway,
            message: "CMS write unavailable",
          }),
      });
      return toProxiedResponse(upstream);
    }),
    (error) => error,
    context,
  );
};

/**
 * Session-gated GET proxy for author-only reads (revision history). Same
 * gates as writes: trusted origin plus a live session, then a bodiless
 * forward so GET/HEAD never carry a body upstream.
 */
const proxyAuthoredGet = (
  request: Request,
  apiUrl: string,
  adapterOrigin: string,
  token: string | undefined,
  context: LogContext,
) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/content/, "");
  return runAdapter(
    Effect.gen(function* () {
      yield* requireTrustedWriteOrigin(request, writeOriginOptions(request, adapterOrigin));
      const upstream = yield* Effect.tryPromise({
        try: () =>
          fetch(`${apiUrl}${path}${url.search}`, {
            headers: forwardHeaders(request.headers, token),
            redirect: "manual",
          }),
        catch: () =>
          new AdapterError({
            status: HttpStatus.BadGateway,
            message: "CMS read unavailable",
          }),
      });
      return toProxiedResponse(upstream);
    }),
    (error) => error,
    context,
  );
};

/** Public byte proxy for media files (`<img>` tags carry no auth). */
const proxyFile = (
  request: Request,
  apiUrl: string,
  token: string | undefined,
  context: LogContext,
) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/content/, "");
  return runAdapter(
    Effect.gen(function* () {
      const upstream = yield* Effect.tryPromise({
        try: () =>
          fetch(`${apiUrl}${path}${url.search}`, {
            headers: forwardHeaders(request.headers, token),
            redirect: "manual",
          }),
        catch: () =>
          new AdapterError({
            status: HttpStatus.BadGateway,
            message: "CMS media unavailable",
          }),
      });
      return toProxiedResponse(upstream);
    }),
    (error) => error,
    context,
  );
};

const writeRoute = async ({ request }: { request: Request }) => {
  const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
  return proxyWrite(request, apiUrl, adapterOrigin, token, context);
};

const authoredGetRoute = async ({ request }: { request: Request }) => {
  const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
  return proxyAuthoredGet(request, apiUrl, adapterOrigin, token, context);
};

const toFeedDoc = (post: CmsPost) => ({
  id: post.id,
  title: post.title,
  summary: post.summary ?? post.meta.description ?? "",
  slug: post.slug,
  publishedAt: post.publishedAt,
  content: post.html,
});

/** Arena channel references embedded in a Tiptap document, in order. */
export const extractArenaRefs = (doc: TiptapDoc): Array<ArenaRef> => {
  const refs: Array<ArenaRef> = [];
  const walk = (blocks: ReadonlyArray<TiptapBlock>): void => {
    for (const block of blocks) {
      if (block.type === "arena") {
        refs.push(
          block.attrs.title === undefined
            ? { slug: block.attrs.slug }
            : { slug: block.attrs.slug, title: block.attrs.title },
        );
      }
      if (block.type === "banner" || block.type === "blockquote") walk(block.content);
    }
  };
  walk(doc.content);
  return refs;
};

type PostQuery = typeof CmsPagingSchema.Type;

/**
 * Forward the session credential so the API can unlock drafts. Cookie and
 * bearer both ride the hop — the API's hasSessionCredential keys off the
 * same pair, so a bearer-authed admin never reads published-only data that
 * the edge then caches as public.
 */
const sessionHeaders = (request: Request) => {
  const headers: Record<string, string> = {};
  const cookie = request.headers.get("cookie");
  if (cookie !== null) headers["cookie"] = cookie;
  const authorization = request.headers.get("authorization");
  if (authorization !== null) headers["authorization"] = authorization;
  return headers;
};

type UpstreamQuery = {
  status?: CmsStatusFilter;
  category?: CmsSlug;
  excludeCategory?: CmsSlug;
};

const toUpstreamQuery = (query: PostQuery): UpstreamQuery => {
  const upstream: UpstreamQuery = {};
  if (query.status !== undefined) upstream.status = query.status;
  if (query.category !== undefined) upstream.category = query.category;
  if (query.excludeCategory !== undefined) upstream.excludeCategory = query.excludeCategory;
  return upstream;
};

/**
 * Works have no categories: fail closed instead of 200ing an unfiltered
 * list the caller believes is filtered. The API enforces the same gate.
 */
const rejectWorkCategory = (query: PostQuery): void => {
  if (query.category !== undefined || query.excludeCategory !== undefined) {
    throw new AdapterError({
      status: HttpStatus.BadRequest,
      message: "Category filter not supported for works",
    });
  }
};

const postQuerySchema = Schema.toStandardSchemaV1(CmsPagingSchema);

const feedQuerySchema = Schema.toStandardSchemaV1(
  Schema.Struct({ limit: Schema.optional(Schema.FiniteFromString) }),
);

const SlugParamsSchema = Schema.toStandardSchemaV1(Schema.Struct({ slug: Schema.String }));

const RevisionParamsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ slug: Schema.String, revId: Schema.String }),
);

const MediaParamsSchema = Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String }));

export const cmsIntegration = new Elysia({ name: "cms" })
  .get(
    "/content/posts",
    async ({ query, request, set }) =>
      proxyCachedCms(request, set, "posts", (api) =>
        api.posts.get({
          query: {
            page: query.page ?? 1,
            pageSize: query.pageSize ?? POSTS_PAGE_SIZE,
            ...toUpstreamQuery(query),
          },
          headers: sessionHeaders(request),
        }),
      ),
    {
      query: postQuerySchema,
      detail: { description: "List posts (drafts need a session)", tags: ["cms"] },
    },
  )
  .get(
    // Static before dynamic: "/content/posts/summary" must not read as a slug.
    "/content/posts/summary",
    async ({ query, request, set }) =>
      proxyCachedCms(request, set, "post summaries", (api) =>
        api.posts.summary.get({
          query: {
            page: query.page ?? 1,
            pageSize: query.pageSize ?? POSTS_PAGE_SIZE,
            ...toUpstreamQuery(query),
          },
          headers: sessionHeaders(request),
        }),
      ),
    {
      query: postQuerySchema,
      detail: {
        description: "List post summaries, no body (drafts need a session)",
        tags: ["cms"],
      },
    },
  )
  .get(
    "/content/posts/:slug",
    async ({ params, request, set }) => {
      const post = await proxyCachedCms(request, set, "post", (api) =>
        api.posts({ slug: params.slug }).get({ headers: sessionHeaders(request) }),
      );
      return { ...post, arenaBlocks: extractArenaRefs(post.content) };
    },
    {
      params: SlugParamsSchema,
      detail: { description: "Get a post by slug (drafts need a session)", tags: ["cms"] },
    },
  )
  .get(
    "/content/works",
    async ({ query, request, set }) => {
      rejectWorkCategory(query);
      return proxyCachedCms(request, set, "works", (api) =>
        api.works.get({
          query: {
            page: query.page ?? 1,
            pageSize: query.pageSize ?? WORKS_PAGE_SIZE,
            ...toUpstreamQuery(query),
          },
          headers: sessionHeaders(request),
        }),
      );
    },
    {
      query: postQuerySchema,
      detail: { description: "List works (drafts need a session)", tags: ["cms"] },
    },
  )
  .get(
    // Static before dynamic: "/content/works/summary" must not read as a slug.
    "/content/works/summary",
    async ({ query, request, set }) => {
      rejectWorkCategory(query);
      return proxyCachedCms(request, set, "work summaries", (api) =>
        api.works.summary.get({
          query: {
            page: query.page ?? 1,
            pageSize: query.pageSize ?? WORKS_PAGE_SIZE,
            ...toUpstreamQuery(query),
          },
          headers: sessionHeaders(request),
        }),
      );
    },
    {
      query: postQuerySchema,
      detail: {
        description: "List work summaries, no body (drafts need a session)",
        tags: ["cms"],
      },
    },
  )
  .get(
    "/content/works/:slug",
    async ({ params, request, set }) => {
      const work = await proxyCachedCms(request, set, "work", (api) =>
        api.works({ slug: params.slug }).get({ headers: sessionHeaders(request) }),
      );
      return { ...work, arenaBlocks: extractArenaRefs(work.content) };
    },
    {
      params: SlugParamsSchema,
      detail: { description: "Get a work by slug (drafts need a session)", tags: ["cms"] },
    },
  )
  .get(
    "/content/categories",
    async ({ request, set }) =>
      proxyCachedCms(request, set, "categories", (api) => api.categories.get()),
    {
      detail: { description: "List categories", tags: ["cms"] },
    },
  )
  .get(
    "/content/media/:id",
    async ({ params, request, set }) =>
      proxyCachedCms(request, set, "media", (api) => api.media({ id: params.id }).get()),
    {
      params: MediaParamsSchema,
      detail: { description: "Get media metadata by id", tags: ["cms"] },
    },
  )
  .get("/content/media", authoredGetRoute, {
    detail: { description: "List media, newest first (session required)", tags: ["cms"] },
  })
  .get("/content/media/:id/usage", authoredGetRoute, {
    params: MediaParamsSchema,
    detail: { description: "Posts and works using an asset (session required)", tags: ["cms"] },
  })
  .get(
    "/content/media/:id/file",
    async ({ request }) => {
      const { apiUrl, token, context } = await cmsApi(request);
      return proxyFile(request, apiUrl, token, context);
    },
    {
      params: MediaParamsSchema,
      detail: { description: "Serve media file bytes by id", tags: ["cms"] },
    },
  )
  .get(
    "/content/feed",
    async ({ query, request, set }) => {
      const posts = await proxyCachedCms(request, set, "feed", (api) =>
        api.posts.get({
          query: { page: 1, pageSize: query.limit ?? 20 },
          headers: sessionHeaders(request),
        }),
      );
      return { docs: posts.docs.map(toFeedDoc) };
    },
    {
      query: feedQuerySchema,
      detail: { description: "Recent posts for feeds", tags: ["cms"] },
    },
  )
  .post("/content/posts", writeRoute, {
    detail: { description: "Create a post", tags: ["cms"] },
  })
  .put("/content/posts/:slug", writeRoute, {
    detail: { description: "Update a post", tags: ["cms"] },
  })
  .delete("/content/posts/:slug", writeRoute, {
    detail: { description: "Delete a post", tags: ["cms"] },
  })
  .get("/content/posts/:slug/revisions", authoredGetRoute, {
    params: SlugParamsSchema,
    detail: { description: "List a post's revisions (session required)", tags: ["cms"] },
  })
  .get("/content/posts/:slug/revisions/:revId", authoredGetRoute, {
    params: RevisionParamsSchema,
    detail: { description: "Get a post revision snapshot (session required)", tags: ["cms"] },
  })
  .post("/content/posts/:slug/restore", writeRoute, {
    params: SlugParamsSchema,
    detail: { description: "Restore a post revision", tags: ["cms"] },
  })
  .post("/content/works", writeRoute, {
    detail: { description: "Create a work", tags: ["cms"] },
  })
  .put("/content/works/:slug", writeRoute, {
    detail: { description: "Update a work", tags: ["cms"] },
  })
  .delete("/content/works/:slug", writeRoute, {
    detail: { description: "Delete a work", tags: ["cms"] },
  })
  .get("/content/works/:slug/revisions", authoredGetRoute, {
    params: SlugParamsSchema,
    detail: { description: "List a work's revisions (session required)", tags: ["cms"] },
  })
  .get("/content/works/:slug/revisions/:revId", authoredGetRoute, {
    params: RevisionParamsSchema,
    detail: { description: "Get a work revision snapshot (session required)", tags: ["cms"] },
  })
  .post("/content/works/:slug/restore", writeRoute, {
    params: SlugParamsSchema,
    detail: { description: "Restore a work revision", tags: ["cms"] },
  })
  .post("/content/categories", writeRoute, {
    detail: { description: "Create a category", tags: ["cms"] },
  })
  .delete("/content/categories/:slug", writeRoute, {
    detail: { description: "Delete a category", tags: ["cms"] },
  })
  .post("/content/media", writeRoute, {
    detail: { description: "Upload media", tags: ["cms"] },
  })
  .delete("/content/media/:id", writeRoute, {
    detail: { description: "Delete media", tags: ["cms"] },
  });

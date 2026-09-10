import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import {
  CmsSlug,
  type ArenaRef,
  type CmsPost,
  type TiptapBlock,
  type TiptapDoc,
} from "@tom/schemas/cms";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";
import { HttpStatus, isErrorStatus } from "@tom/constants/http";
import { hasSessionCredential } from "@tom/utils/services/session";
import { readCloudflareEnv } from "@tom/utils/services/config";
import { getRequestEnv, logContextFromRequest } from "@tom/utils/services/worker";
import type { LogContext } from "@tom/utils/services/logging";
import { callApi } from "../../callApi";
import { AdapterError, runAdapter } from "../../config/effect";
import { allowLocalOriginsForAdapter, isTrustedWriteOrigin, tenantFromValue } from "../../origins";
import { forwardHeaders, toProxiedResponse } from "../auth";
import { simulatorEnv } from "../../simulator";

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

const apiBase = "http://localhost:8787";

const cmsApi = async (request: Request) => {
  const env = simulatorEnv(await readCloudflareEnv(getRequestEnv(request)), request);
  return {
    api: callApi(env.API_URL ?? apiBase),
    apiUrl: env.API_URL ?? apiBase,
    adapterOrigin: env.ADAPTER_URL ?? "http://localhost:8788",
    token: env.INTERNAL_API_TOKEN,
    context: logContextFromRequest(request, "tom-adapter"),
  };
};

const SessionBodySchema = Schema.Struct({ session: Schema.Unknown });

/**
 * Edge TTLs for anonymous CMS reads: a minute fresh at the edge, five in a
 * shared cache, a day of stale-while-revalidate. Content edits are rare and
 * readers tolerate slight staleness; session reads (drafts) never store.
 */
const PUBLIC_CMS_CACHE = "public, max-age=60, s-maxage=300, stale-while-revalidate=86400";
const PRIVATE_NO_STORE = "private, no-store";

/** List page sizes mirror the index pages that consume them. */
const POSTS_PAGE_SIZE = 5;
const WORKS_PAGE_SIZE = 10;

/**
 * Edge-cache public CMS reads. Anonymous responses are identical for every
 * reader (published only), so they cache at the edge with
 * stale-while-revalidate; session requests carry drafts and never store.
 * Only anonymous responses ever populate the cache, so an admin preview
 * may read stale-published but an anonymous reader can never see drafts.
 * Called only after a successful proxy — error responses never store.
 */
const setCmsCache = (request: Request, set: { headers: Record<string, string | number> }): void => {
  if (hasSessionCredential(request)) {
    set.headers["Cache-Control"] = PRIVATE_NO_STORE;
    return;
  }
  set.headers["Cache-Control"] = PUBLIC_CMS_CACHE;
  set.headers["CDN-Cache-Control"] = PUBLIC_CMS_CACHE;
};

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
  setCmsCache(request, set);
  return data;
};

/**
 * Session gate for CMS writes. The browser session cookie rides the
 * request; the adapter asks the API for the session before forwarding the
 * write, so anonymous callers get a 401 without touching content. The API
 * re-checks the session itself — fail-closed on both hops.
 */
const requireContentSession = (
  request: Request,
  apiUrl: string,
  token: string | undefined,
): Effect.Effect<void, AdapterError> =>
  Effect.tryPromise({
    try: () => {
      const headers = new Headers();
      const cookie = request.headers.get("cookie");
      if (cookie) headers.set("cookie", cookie);
      if (token) headers.set(INTERNAL_TOKEN_HEADER, token);
      return fetch(`${apiUrl}/auth/get-session`, { headers, redirect: "manual" });
    },
    catch: () =>
      new AdapterError({
        status: HttpStatus.BadGateway,
        message: "CMS auth unavailable",
      }),
  }).pipe(
    Effect.flatMap((response) =>
      Effect.tryPromise({
        try: () => response.json() as Promise<unknown>,
        catch: () =>
          new AdapterError({
            status: HttpStatus.BadGateway,
            message: "CMS auth unavailable",
          }),
      }),
    ),
    Effect.flatMap((body) =>
      Schema.is(SessionBodySchema)(body) && body.session !== null && body.session !== undefined
        ? Effect.void
        : Effect.fail(
            new AdapterError({
              status: HttpStatus.Unauthorized,
              message: "CMS session required",
            }),
          ),
    ),
  );

/**
 * Origins allowed to drive CMS writes. The adapter itself always passes;
 * web origins must match the tenant-scoped allowlist (see origins). Local
 * editors pass only off production. Requests without Origin/Referer are
 * non-browser callers (curl) and pass.
 */
const refererOrigin = (referer: string): Effect.Effect<string, never> =>
  Effect.try(() => new URL(referer).origin).pipe(Effect.orElseSucceed(() => ""));

/**
 * CSRF gate for CMS writes. Session cookies travel cross-site
 * (SameSite=None), and multipart POSTs are CORS-safelisted, so the proxy
 * itself verifies the request came from a trusted page.
 */
const requireTrustedWriteOrigin = (
  request: Request,
  adapterOrigin: string,
): Effect.Effect<void, AdapterError> =>
  Effect.gen(function* () {
    const env = getRequestEnv(request);
    const allowLocalOrigins = allowLocalOriginsForAdapter(env.ADAPTER_URL);
    const tenant = tenantFromValue(env.TENANT);
    const direct = request.headers.get("origin");
    if (direct !== null) {
      return yield* isTrustedWriteOrigin(direct, adapterOrigin, allowLocalOrigins, tenant)
        ? Effect.void
        : Effect.fail(
            new AdapterError({
              status: HttpStatus.Forbidden,
              message: "Untrusted write origin",
            }),
          );
    }
    const referer = request.headers.get("referer");
    if (referer === null) return;
    const origin = yield* refererOrigin(referer);
    if (!isTrustedWriteOrigin(origin, adapterOrigin, allowLocalOrigins, tenant)) {
      return yield* Effect.fail(
        new AdapterError({
          status: HttpStatus.Forbidden,
          message: "Untrusted write origin",
        }),
      );
    }
  });

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
      yield* requireTrustedWriteOrigin(request, adapterOrigin);
      yield* requireContentSession(request, apiUrl, token);
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
      yield* requireTrustedWriteOrigin(request, adapterOrigin);
      yield* requireContentSession(request, apiUrl, token);
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
    Effect.tryPromise({
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
    }).pipe(Effect.map(toProxiedResponse)),
    (error) => error,
    context,
  );
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

const PostQuerySchema = Schema.Struct({
  page: Schema.optional(Schema.NumberFromString),
  pageSize: Schema.optional(Schema.NumberFromString),
  status: Schema.optional(Schema.Literals(["all", "draft", "published"])),
  category: Schema.optional(CmsSlug),
  excludeCategory: Schema.optional(CmsSlug),
});

type PostQuery = typeof PostQuerySchema.Type;

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

const statusQuery = (query: PostQuery): { status?: "all" | "draft" | "published" } =>
  query.status === undefined ? {} : { status: query.status };

const categoryQuery = (query: PostQuery): { category?: string } =>
  query.category === undefined ? {} : { category: query.category };

const excludeCategoryQuery = (query: PostQuery): { excludeCategory?: string } =>
  query.excludeCategory === undefined ? {} : { excludeCategory: query.excludeCategory };

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

const postQuerySchema = Schema.toStandardSchemaV1(PostQuerySchema);

const feedQuerySchema = Schema.toStandardSchemaV1(
  Schema.Struct({ limit: Schema.optional(Schema.NumberFromString) }),
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
            ...statusQuery(query),
            ...categoryQuery(query),
            ...excludeCategoryQuery(query),
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
            ...statusQuery(query),
            ...categoryQuery(query),
            ...excludeCategoryQuery(query),
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
            ...statusQuery(query),
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
            ...statusQuery(query),
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
  .get(
    "/content/media",
    async ({ request }) => {
      const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
      return proxyAuthoredGet(request, apiUrl, adapterOrigin, token, context);
    },
    {
      detail: { description: "List media, newest first (session required)", tags: ["cms"] },
    },
  )
  .get(
    "/content/media/:id/usage",
    async ({ request }) => {
      const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
      return proxyAuthoredGet(request, apiUrl, adapterOrigin, token, context);
    },
    {
      params: MediaParamsSchema,
      detail: { description: "Posts and works using an asset (session required)", tags: ["cms"] },
    },
  )
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
  .post(
    "/content/posts",
    async ({ request }) => {
      const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
      return proxyWrite(request, apiUrl, adapterOrigin, token, context);
    },
    {
      detail: { description: "Create a post", tags: ["cms"] },
    },
  )
  .put(
    "/content/posts/:slug",
    async ({ request }) => {
      const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
      return proxyWrite(request, apiUrl, adapterOrigin, token, context);
    },
    {
      detail: { description: "Update a post", tags: ["cms"] },
    },
  )
  .delete(
    "/content/posts/:slug",
    async ({ request }) => {
      const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
      return proxyWrite(request, apiUrl, adapterOrigin, token, context);
    },
    {
      detail: { description: "Delete a post", tags: ["cms"] },
    },
  )
  .get(
    "/content/posts/:slug/revisions",
    async ({ request }) => {
      const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
      return proxyAuthoredGet(request, apiUrl, adapterOrigin, token, context);
    },
    {
      params: SlugParamsSchema,
      detail: { description: "List a post's revisions (session required)", tags: ["cms"] },
    },
  )
  .get(
    "/content/posts/:slug/revisions/:revId",
    async ({ request }) => {
      const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
      return proxyAuthoredGet(request, apiUrl, adapterOrigin, token, context);
    },
    {
      params: RevisionParamsSchema,
      detail: { description: "Get a post revision snapshot (session required)", tags: ["cms"] },
    },
  )
  .post(
    "/content/posts/:slug/restore",
    async ({ request }) => {
      const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
      return proxyWrite(request, apiUrl, adapterOrigin, token, context);
    },
    {
      params: SlugParamsSchema,
      detail: { description: "Restore a post revision", tags: ["cms"] },
    },
  )
  .post(
    "/content/works",
    async ({ request }) => {
      const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
      return proxyWrite(request, apiUrl, adapterOrigin, token, context);
    },
    {
      detail: { description: "Create a work", tags: ["cms"] },
    },
  )
  .put(
    "/content/works/:slug",
    async ({ request }) => {
      const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
      return proxyWrite(request, apiUrl, adapterOrigin, token, context);
    },
    {
      detail: { description: "Update a work", tags: ["cms"] },
    },
  )
  .delete(
    "/content/works/:slug",
    async ({ request }) => {
      const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
      return proxyWrite(request, apiUrl, adapterOrigin, token, context);
    },
    {
      detail: { description: "Delete a work", tags: ["cms"] },
    },
  )
  .get(
    "/content/works/:slug/revisions",
    async ({ request }) => {
      const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
      return proxyAuthoredGet(request, apiUrl, adapterOrigin, token, context);
    },
    {
      params: SlugParamsSchema,
      detail: { description: "List a work's revisions (session required)", tags: ["cms"] },
    },
  )
  .get(
    "/content/works/:slug/revisions/:revId",
    async ({ request }) => {
      const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
      return proxyAuthoredGet(request, apiUrl, adapterOrigin, token, context);
    },
    {
      params: RevisionParamsSchema,
      detail: { description: "Get a work revision snapshot (session required)", tags: ["cms"] },
    },
  )
  .post(
    "/content/works/:slug/restore",
    async ({ request }) => {
      const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
      return proxyWrite(request, apiUrl, adapterOrigin, token, context);
    },
    {
      params: SlugParamsSchema,
      detail: { description: "Restore a work revision", tags: ["cms"] },
    },
  )
  .post(
    "/content/categories",
    async ({ request }) => {
      const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
      return proxyWrite(request, apiUrl, adapterOrigin, token, context);
    },
    {
      detail: { description: "Create a category", tags: ["cms"] },
    },
  )
  .delete(
    "/content/categories/:slug",
    async ({ request }) => {
      const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
      return proxyWrite(request, apiUrl, adapterOrigin, token, context);
    },
    {
      detail: { description: "Delete a category", tags: ["cms"] },
    },
  )
  .post(
    "/content/media",
    async ({ request }) => {
      const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
      return proxyWrite(request, apiUrl, adapterOrigin, token, context);
    },
    {
      detail: { description: "Upload media", tags: ["cms"] },
    },
  )
  .delete(
    "/content/media/:id",
    async ({ request }) => {
      const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
      return proxyWrite(request, apiUrl, adapterOrigin, token, context);
    },
    {
      detail: { description: "Delete media", tags: ["cms"] },
    },
  );

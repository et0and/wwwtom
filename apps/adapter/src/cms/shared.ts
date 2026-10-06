import { Effect, Schema } from "effect";
import {
  CmsPagingSchema,
  type ArenaRef,
  type CmsSlug,
  type CmsStatusFilter,
  type TiptapBlock,
  type TiptapDoc,
} from "@tom/schemas/cms";
import { HttpStatus, isErrorStatus } from "@tom/constants/http";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import { readCloudflareEnv } from "@tom/utils/config";
import { getRequestEnv, logContextFromRequest } from "@tom/utils/worker";
import type { LogContext } from "@tom/utils/logging";
import { callApi } from "../callApi";
import { AdapterError, runAdapter } from "../runtime";
import { allowLocalOriginsForAdapter, tenantFromValue } from "../origins";
import { forwardHeaders, toProxiedResponse } from "../auth/forward";
import { requireTrustedWriteOrigin, type WriteOriginGateOptions } from "../write-origin-gate";
import { simulatorEnv } from "../simulator";
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
export const POSTS_PAGE_SIZE = 5;
export const WORKS_PAGE_SIZE = 10;

export type CmsApi = Awaited<ReturnType<typeof cmsApi>>["api"];

/**
 * Proxy a public CMS read, then mark it cacheable. The cache headers go on
 * after the upstream succeeds so 404/500 problem responses never store at
 * the edge (a fresh slug would 404 for the whole s-maxage otherwise).
 */
export const proxyCachedCms = async <T>(
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
export const proxyFile = (
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

export const writeRoute = async ({ request }: { request: Request }) => {
  const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
  return proxyWrite(request, apiUrl, adapterOrigin, token, context);
};

export const authoredGetRoute = async ({ request }: { request: Request }) => {
  const { apiUrl, adapterOrigin, token, context } = await cmsApi(request);
  return proxyAuthoredGet(request, apiUrl, adapterOrigin, token, context);
};

export const mediaFileRoute = async ({ request }: { request: Request }) => {
  const { apiUrl, token, context } = await cmsApi(request);
  return proxyFile(request, apiUrl, token, context);
};

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

export type PostQuery = typeof CmsPagingSchema.Type;

/**
 * Forward the session credential so the API can unlock drafts. Cookie and
 * bearer both ride the hop — the API's hasSessionCredential keys off the
 * same pair, so a bearer-authed admin never reads published-only data that
 * the edge then caches as public.
 */
export const sessionHeaders = (request: Request) => {
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

export const toUpstreamQuery = (query: PostQuery): UpstreamQuery => {
  const { status, category, excludeCategory } = query;
  return {
    ...(status !== undefined && { status }),
    ...(category !== undefined && { category }),
    ...(excludeCategory !== undefined && { excludeCategory }),
  };
};

/**
 * Works have no categories: fail closed instead of 200ing an unfiltered
 * list the caller believes is filtered. The API enforces the same gate.
 */
export const rejectWorkCategory = (query: PostQuery): void => {
  if (query.category !== undefined || query.excludeCategory !== undefined) {
    throw new AdapterError({
      status: HttpStatus.BadRequest,
      message: "Category filter not supported for works",
    });
  }
};

export const postQuerySchema = Schema.toStandardSchemaV1(CmsPagingSchema);

export const feedQuerySchema = Schema.toStandardSchemaV1(
  Schema.Struct({ limit: Schema.optional(Schema.FiniteFromString) }),
);

export const SlugParamsSchema = Schema.toStandardSchemaV1(Schema.Struct({ slug: Schema.String }));

export const RevisionParamsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ slug: Schema.String, revId: Schema.String }),
);

export const MediaParamsSchema = Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String }));

export { cmsApi };

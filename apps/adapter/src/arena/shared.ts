import { treaty } from "@elysiajs/eden";
import { Schema } from "effect";
import type { ApiApp } from "@tom/api";
import { HttpStatus, isErrorStatus } from "@tom/constants/http";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import { readCloudflareEnv, tenantFromValue } from "@tom/utils/config";
import { getRequestEnv } from "@tom/utils/worker";
import { callApi } from "../callApi";
import { AdapterError } from "../runtime";
import type { PaginationQuery } from "../schemas";

export type ArenaApi = ReturnType<typeof treaty<ApiApp>>;

/**
 * are.na-backed content serves every tenant except Sophie — local dev and
 * tests run without TENANT. Sophie keeps the D1 CMS on /content/*.
 */
export const requireArenaTenant = (request: Request): void => {
  if (tenantFromValue(getRequestEnv(request).TENANT) === "sophie") {
    throw new AdapterError({ status: HttpStatus.NotFound, message: "Not found" });
  }
};

/**
 * Typed client to the internal are.na routes. Deployed stages reach api over
 * the service binding (same colo, no public hostname); local dev and the e2e
 * harness fall back to API_URL. The internal token is attached here, never by
 * the browser.
 */
export const arenaApi = async (request: Request): Promise<ArenaApi> => {
  const env = await readCloudflareEnv(getRequestEnv(request));
  const cookie = request.headers.get("cookie");
  return callApi(env.API_URL ?? LOCAL_SERVICE_URLS.api, {
    token: env.INTERNAL_API_TOKEN,
    fetcher: env.API?.fetch.bind(env.API),
    // The api decides cache policy from the session credential, so a
    // signed-in read must arrive with the browser's cookie.
    ...(cookie !== null && { headers: { cookie } }),
  });
};

/**
 * Unwrap an internal are.na read and forward its cache policy. The api owns
 * `Cache-Control` (it knows which reads are public and session-free), so the
 * adapter copies the headers onto the public response instead of deciding
 * again. Failures become AdapterErrors for the global onError hook.
 */
type ArenaResponse = {
  readonly data: unknown;
  readonly error: unknown;
  readonly status: number;
  readonly headers: HeadersInit | undefined;
};

export const proxyArena = async <R extends ArenaResponse>(
  call: Promise<R>,
  set: { headers: Record<string, string | number> },
  resource: string,
): Promise<NonNullable<R["data"]>> => {
  const result = await call;
  if (result.error !== null || result.data === null) {
    throw new AdapterError({
      status: isErrorStatus(result.status) ? result.status : HttpStatus.InternalServerError,
      message:
        result.status === HttpStatus.NotFound
          ? `Arena ${resource} not found`
          : `Arena ${resource} request failed`,
    });
  }
  const headers = new Headers(result.headers);
  const cacheControl = headers.get("cache-control");
  const cdnCacheControl = headers.get("cdn-cache-control");
  if (cacheControl !== null) set.headers["Cache-Control"] = cacheControl;
  if (cdnCacheControl !== null) set.headers["CDN-Cache-Control"] = cdnCacheControl;
  return result.data as NonNullable<R["data"]>;
};

export const ChannelSlugParamsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ slug: Schema.String }),
);

export const IdOrSlugParamsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ id: Schema.Union([Schema.FiniteFromString, Schema.String]) }),
);

export const BlockIdParamsSchema = Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.Finite }));

export const arenaListQuerySchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    page: Schema.optional(Schema.FiniteFromString),
    pageSize: Schema.optional(Schema.FiniteFromString),
  }),
);

export const arenaSlugParamsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ slug: Schema.String }),
);

export const feedQuerySchema = Schema.toStandardSchemaV1(
  Schema.Struct({ limit: Schema.optional(Schema.FiniteFromString) }),
);

/**
 * The pagination fields the caller set, or `undefined` when none were. Keys
 * without a value are omitted rather than passed as `undefined`: the Arena
 * client spreads these over its defaults, so an explicit `per: undefined`
 * would clobber the default page size.
 */
export const pagingParams = (query: PaginationQuery) => {
  const paging = toPaginationAttributes(query);
  return paging === undefined ? undefined : { query: paging };
};

export const toPaginationAttributes = (query: PaginationQuery) => {
  const { page, per, sort, direction } = query;
  if ([page, per, sort, direction].every((value) => value === undefined)) return undefined;
  return {
    ...(page !== undefined && { page }),
    ...(per !== undefined && { per }),
    ...(sort !== undefined && { sort }),
    ...(direction !== undefined && { direction }),
  };
};

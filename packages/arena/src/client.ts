import { Cause, Effect, Option, Schema } from "effect";
import {
  createArena,
  ArenaApiError,
  ArenaNetworkError,
  type Arena,
  type Channel,
} from "@aredotna/sdk";
import {
  GetChannelsApiResponseSchema,
  GetChannelThumbApiResponseSchema,
  GetGroupChannelsApiResponseSchema,
  GetUserChannelsApiResponseSchema,
  type GetChannelsApiResponse,
  type MeApiResponse,
  type PaginationAttributes,
  type GetGroupApiResponse,
  type GetGroupChannelsApiResponse,
  type SearchApiResponse,
  type GetBlockApiResponse,
  type GetBlockChannelsApiResponse,
  type CreateChannelApiResponse,
  type GetChannelThumbApiResponse,
  type GetChannelContentsApiResponse,
  type GetUserChannelsApiResponse,
  type GetUserApiResponse,
  type GetUserFollowersApiResponse,
  type GetUserFollowingApiResponse,
  type GetBlockCommentApiResponse,
} from "@tom/schemas/arena";
import { normalizeOptionalSecret } from "@tom/schemas/secrets";
import { HttpError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import { workerCache } from "@tom/utils/http";

export interface ArenaBlockApi {
  readonly get: Effect.Effect<GetBlockApiResponse, HttpError>;
  channels(options?: PaginationAttributes): Effect.Effect<GetBlockChannelsApiResponse, HttpError>;
  update(data: {
    title?: string;
    description?: string;
    content?: string;
  }): Effect.Effect<void, HttpError>;
  comments(options?: PaginationAttributes): Effect.Effect<GetBlockCommentApiResponse, HttpError>;
}

export interface ArenaUserApi {
  readonly get: Effect.Effect<GetUserApiResponse, HttpError>;
  channels(options?: PaginationAttributes): Effect.Effect<GetUserChannelsApiResponse, HttpError>;
  readonly following: Effect.Effect<GetUserFollowingApiResponse, HttpError>;
  readonly followers: Effect.Effect<GetUserFollowersApiResponse, HttpError>;
}

export type ChannelStatus = "public" | "closed" | "private";

type ChannelUpdateBody = { title: string; visibility?: ChannelStatus };

export interface ArenaGroupApi {
  readonly get: Effect.Effect<GetGroupApiResponse, HttpError>;
  channels(options?: PaginationAttributes): Effect.Effect<GetGroupChannelsApiResponse, HttpError>;
}

export interface ArenaChannelApi {
  create(status?: ChannelStatus): Effect.Effect<CreateChannelApiResponse, HttpError>;
  readonly get: Effect.Effect<Channel, HttpError>;
  readonly delete: Effect.Effect<void, HttpError>;
  update(data: { title: string; status?: ChannelStatus }): Effect.Effect<void, HttpError>;
  readonly thumb: Effect.Effect<GetChannelThumbApiResponse, HttpError>;
  contents(options?: PaginationAttributes): Effect.Effect<GetChannelContentsApiResponse, HttpError>;
  connections(options?: PaginationAttributes): Effect.Effect<ChannelConnections, HttpError>;
}

export interface ArenaSearchApi {
  everything(
    query: string,
    options?: PaginationAttributes,
  ): Effect.Effect<SearchApiResponse, HttpError>;
  users(query: string, options?: PaginationAttributes): Effect.Effect<SearchApiResponse, HttpError>;
  channels(
    query: string,
    options?: PaginationAttributes,
  ): Effect.Effect<SearchApiResponse, HttpError>;
  blocks(
    query: string,
    options?: PaginationAttributes,
  ): Effect.Effect<SearchApiResponse, HttpError>;
}

export interface ArenaApi {
  readonly me: Effect.Effect<MeApiResponse, HttpError>;
  channels(options?: PaginationAttributes): Effect.Effect<GetChannelsApiResponse, HttpError>;
  user(id: number | string): ArenaUserApi;
  group(slug: string): ArenaGroupApi;
  channel(slug: string): ArenaChannelApi;
  block(id: number): ArenaBlockApi;
  readonly search: ArenaSearchApi;
}

export type Fetch = (
  url: RequestInfo,
  init?: RequestInit & {
    cf?: {
      cacheTtl?: number;
      cacheKey?: string;
      cacheTtlByStatus?: Record<string, number>;
    };
  },
) => Promise<Response>;

/** Run an SDK promise as an Effect, mapping SDK errors to HttpError. */
const sdkEffect = <T>(run: () => Promise<T>): Effect.Effect<T, HttpError> =>
  Effect.tryPromise({ try: run, catch: mapArenaError });

const formatSort = (sort?: string, direction?: string): string | undefined => {
  if (sort && direction) return `${sort}_${direction}`;
  if (sort) return sort;
  return undefined;
};

export type DateProvider = { now(): number };

type CfOptions = NonNullable<NonNullable<Parameters<Fetch>[1]>["cf"]>;

const PUBLIC_CACHE_TTL_SECONDS = 86400;

/**
 * Public reads may sit in the Cloudflare edge cache. The key carries no
 * credentials, so only unauthenticated requests may use it. Content is
 * held for 24 hours; errors never cache.
 */
const publicCacheOptions = (url: string): CfOptions => ({
  cacheTtl: PUBLIC_CACHE_TTL_SECONDS,
  cacheKey: `arena:v3:public:${url}`,
  cacheTtlByStatus: { "400-599": 0 },
});

const workerCacheKey = (url: string): Request =>
  new Request(`https://arena-cache.internal/${encodeURIComponent(url)}`, { method: "GET" });

/**
 * Cloudflare's per-fetch cache is zone-scoped, so reads from a worker to
 * api.are.na are not cached by `cf.cacheTtl` alone. The Workers Cache API
 * holds them for the response's own max-age, which keeps anonymous browsing
 * inside are.na's 30-requests-per-minute guest tier. Cache failures never
 * fail the read.
 */
const readWorkerCache = async (url: string): Promise<Response | null> => {
  const cache = workerCache();
  if (!cache) return null;
  return (await cache.match(workerCacheKey(url)).catch(() => undefined)) ?? null;
};

/**
 * Store a public read for the full TTL. The Cache API honors the response's
 * own `Cache-Control` — are.na sends `max-age=300` — so the header is
 * rewritten before storing, otherwise the entry expires in five minutes.
 * The write is awaited: unlike `ctx.waitUntil`, a bare `cache.put` can be
 * terminated once the response is returned.
 */
const writeWorkerCache = async (url: string, response: Response): Promise<void> => {
  const cache = workerCache();
  if (!cache) return;
  const cloned = response.clone();
  const headers = new Headers(cloned.headers);
  headers.set("cache-control", `public, max-age=${PUBLIC_CACHE_TTL_SECONDS}`);
  const cacheable = new Response(cloned.body, {
    status: cloned.status,
    statusText: cloned.statusText,
    headers,
  });
  await cache.put(workerCacheKey(url), cacheable).catch(() => undefined);
};

export const defaultPaginationOptions: PaginationAttributes = {
  sort: "position",
  direction: "desc",
  per: 50,
};

export function paginationQueryString(
  options: PaginationAttributes | undefined,
  dateProvider: DateProvider,
): string {
  const { page, per, sort, direction, forceRefresh } = resolvePagination(options);
  const attrs: string[] = [];
  if (page) attrs.push(`page=${page}`);
  if (per) attrs.push(`per_page=${per}`);
  const combined = formatSort(sort, direction);
  if (combined) attrs.push(`sort=${combined}`);
  if (forceRefresh) attrs.push(`date=${dateProvider.now()}`);
  return attrs.join("&");
}

function mapArenaError(cause: unknown): HttpError {
  if (cause instanceof ArenaApiError) {
    return new HttpError({ message: cause.message, status: cause.status });
  }
  if (cause instanceof ArenaNetworkError) {
    // No HTTP response arrived; 502 is the truthful status for an upstream
    // the adapter could not reach (never use 0 as a sentinel).
    return new HttpError({ message: cause.message, status: HttpStatus.BadGateway });
  }
  return new HttpError({
    message: "Arena request failed",
    status: HttpStatus.InternalServerError,
    cause,
  });
}

type ChannelConnections = Awaited<ReturnType<Arena["channels"]["connections"]>>;
type ConnectionsQuery = NonNullable<Parameters<Arena["channels"]["connections"]>[1]>;
type SearchQuery = NonNullable<Parameters<Arena["search"]["query"]>[0]>;

interface PageParams {
  page?: number;
  per?: number;
}

const pageParams = (options: PaginationAttributes | undefined): PageParams => {
  const { page, per } = resolvePagination(options);
  return {
    ...(page !== undefined && { page }),
    ...(per !== undefined && { per }),
  };
};

const ContentsSortSchema = Schema.Literals([
  "position_asc",
  "position_desc",
  "created_at_asc",
  "created_at_desc",
  "updated_at_asc",
  "updated_at_desc",
]);

const ConnectionsSortSchema = Schema.Literals(["created_at_asc", "created_at_desc"]);

const SearchSortSchema = Schema.Literals([
  "score_desc",
  "created_at_asc",
  "created_at_desc",
  "updated_at_asc",
  "updated_at_desc",
  "name_asc",
  "name_desc",
  "connections_count_desc",
]);

/**
 * Decode a `<field>_<direction>` sort into one endpoint's allowlist. An unknown
 * combination yields no sort rather than an error, so a caller can ask for a
 * sort are.na does not support and still get results.
 */
const pickSort = <TSort extends string>(
  sort: string | undefined,
  direction: string | undefined,
  schema: Schema.Codec<TSort>,
): TSort | undefined =>
  Option.getOrUndefined(Schema.decodeUnknownOption(schema)(formatSort(sort, direction)));

/** Caller paging over the endpoint defaults, resolved once. */
const resolvePagination = (options: PaginationAttributes | undefined): PaginationAttributes => ({
  ...defaultPaginationOptions,
  ...options,
});

const withSort = <TSort extends string>(
  options: PaginationAttributes | undefined,
  schema: Schema.Codec<TSort>,
): PageParams & { sort?: TSort } => {
  const { sort, direction } = resolvePagination(options);
  const picked = pickSort(sort, direction, schema);
  return { ...pageParams(options), ...(picked !== undefined && { sort: picked }) };
};

const toConnectionsQuery = (options: PaginationAttributes | undefined): ConnectionsQuery =>
  withSort(options, ConnectionsSortSchema);

function toSdkSearchQuery(
  query: string,
  type: "users" | "channels" | "blocks" | undefined,
  options: PaginationAttributes | undefined,
): SearchQuery {
  const { sort, direction } = resolvePagination(options);
  const result: SearchQuery = { query, ...pageParams(options) };
  const sortParam = pickSort(sort, direction, SearchSortSchema);
  if (sortParam !== undefined) result.sort = sortParam;
  if (type === "users") result.type = ["User"];
  if (type === "channels") result.type = ["Channel"];
  if (type === "blocks") result.type = ["Block"];
  return result;
}

export class ArenaClient implements ArenaApi {
  private readonly domain: string;
  private readonly headers: Record<string, string>;
  private readonly rawFetch: Fetch;
  private readonly date: DateProvider;
  private readonly arena: Arena;

  private static normalizeToken(token?: string | null): string | null {
    return normalizeOptionalSecret(token ?? undefined) ?? null;
  }

  private static hasAuthorizationHeader(headers: HeadersInit | undefined): boolean {
    if (!headers) return false;
    return new Headers(headers).has("Authorization");
  }

  private static removeAuthorizationHeader(
    headers: HeadersInit | undefined,
  ): HeadersInit | undefined {
    if (!headers) return undefined;
    const normalized = new Headers(headers);
    normalized.delete("Authorization");
    return normalized;
  }

  private createCachedFetch(fetchImpl: Fetch): Fetch {
    return async (input, init) => {
      const url = input instanceof URL ? input.href : input instanceof Request ? input.url : input;
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      // The SDK calls fetch with a Request and no init, so a token lives on
      // the Request headers; checking init alone would cache private reads.
      const requestHeaders = input instanceof Request ? input.headers : init?.headers;
      const hasAuth = ArenaClient.hasAuthorizationHeader(requestHeaders);
      const shouldUseEdgeCache = method === "GET" && !hasAuth;

      const requestInit: NonNullable<Parameters<Fetch>[1]> = shouldUseEdgeCache
        ? { ...init, cf: publicCacheOptions(url) }
        : { ...init, cf: { cacheTtl: 0 } };

      if (shouldUseEdgeCache) {
        const cached = await readWorkerCache(url);
        if (cached) return cached;
      }

      const response = await fetchImpl(input, requestInit);

      if (shouldUseEdgeCache && response.ok) {
        await writeWorkerCache(url, response);
      }

      const shouldRetryWithoutAuth =
        method === "GET" && hasAuth && (response.status === 401 || response.status === 403);

      if (!shouldRetryWithoutAuth) return response;
      return retryWithoutAuth(input, init, url, requestHeaders);
    };

    /**
     * A private GET that the token cannot read (401/403) still has a public
     * twin on the other side of the same wall, so retry once from cache with
     * the Authorization header removed.
     */
    async function retryWithoutAuth(
      input: RequestInfo,
      init: Parameters<Fetch>[1],
      url: string,
      requestHeaders: HeadersInit | undefined,
    ): Promise<Response> {
      const cached = await readWorkerCache(url);
      if (cached) return cached;
      const retryHeaders = ArenaClient.removeAuthorizationHeader(requestHeaders);
      const isRequest = input instanceof Request;
      const retryInit: NonNullable<Parameters<Fetch>[1]> = {
        ...init,
        cf: publicCacheOptions(url),
      };
      if (retryHeaders && !isRequest) retryInit.headers = retryHeaders;
      const response = await fetchImpl(
        isRequest && retryHeaders ? new Request(input, { headers: retryHeaders }) : input,
        retryInit,
      );
      if (response.ok) await writeWorkerCache(url, response);
      return response;
    }
  }

  constructor(config?: {
    token?: string | null;
    fetch?: Fetch;
    date?: DateProvider;
    baseUrl?: string;
  }) {
    const normalizedToken = ArenaClient.normalizeToken(config?.token);
    this.domain = `${config?.baseUrl ?? "https://api.are.na"}/v3/`;
    this.headers = {
      "Content-Type": "application/json",
      ...(normalizedToken && { Authorization: `Bearer ${normalizedToken}` }),
    };
    const wrappedFetch = this.createCachedFetch(config?.fetch || fetch.bind(globalThis));
    this.rawFetch = wrappedFetch;
    this.date = config?.date || Date;
    const sdkFetch: typeof fetch = (input, init) =>
      wrappedFetch(input instanceof URL ? input.href : input, init);
    this.arena = createArena({
      fetch: sdkFetch,
      baseUrl: config?.baseUrl ?? "https://api.are.na",
      ...(normalizedToken && { token: normalizedToken }),
    });
  }

  get me(): Effect.Effect<MeApiResponse, HttpError> {
    return sdkEffect<MeApiResponse>(() => this.arena.me());
  }

  channels(options?: PaginationAttributes): Effect.Effect<GetChannelsApiResponse, HttpError> {
    return this.getJsonWithPaginationQuery("channels", options, GetChannelsApiResponseSchema);
  }

  user(id: number | string): ArenaUserApi {
    return {
      get: sdkEffect<GetUserApiResponse>(() => this.arena.users.get(id)),
      channels: (
        options?: PaginationAttributes,
      ): Effect.Effect<GetUserChannelsApiResponse, HttpError> =>
        this.getJsonWithPaginationQuery(
          `users/${id}/channels`,
          options,
          GetUserChannelsApiResponseSchema,
        ),
      following: sdkEffect<GetUserFollowingApiResponse>(() => this.arena.users.following(id)),
      followers: sdkEffect<GetUserFollowersApiResponse>(() => this.arena.users.followers(id)),
    };
  }

  group(slug: string): ArenaGroupApi {
    return {
      get: sdkEffect<GetGroupApiResponse>(() => this.arena.groups.get(slug)),
      channels: (
        options?: PaginationAttributes,
      ): Effect.Effect<GetGroupChannelsApiResponse, HttpError> =>
        this.getJsonWithPaginationQuery(
          `groups/${slug}/channels`,
          options,
          GetGroupChannelsApiResponseSchema,
        ),
    };
  }

  channel(slug: string): ArenaChannelApi {
    return {
      contents: (
        options?: PaginationAttributes,
      ): Effect.Effect<GetChannelContentsApiResponse, HttpError> =>
        sdkEffect<GetChannelContentsApiResponse>(() =>
          this.arena.channels.contents(slug, withSort(options, ContentsSortSchema)),
        ),
      connections: (options?: PaginationAttributes): Effect.Effect<ChannelConnections, HttpError> =>
        sdkEffect<ChannelConnections>(() =>
          this.arena.channels.connections(slug, toConnectionsQuery(options)),
        ),
      create: (status?: ChannelStatus): Effect.Effect<CreateChannelApiResponse, HttpError> =>
        sdkEffect<CreateChannelApiResponse>(() =>
          this.arena.channels.create({
            title: slug,
            ...(status !== undefined && { visibility: status }),
          }),
        ),
      update: (data: { title: string; status?: ChannelStatus }): Effect.Effect<void, HttpError> =>
        sdkEffect<void>(() => {
          const body: ChannelUpdateBody = { title: data.title };
          if (data.status) body.visibility = data.status;
          return this.arena.channels.update(slug, body).then(() => undefined);
        }),
      get: sdkEffect<Channel>(() => this.arena.channels.get(slug)),
      delete: sdkEffect<void>(() => this.arena.channels.delete(slug)),
      thumb: this.makeRequest(`channels/${slug}/thumb`, GetChannelThumbApiResponseSchema),
    };
  }

  block(id: number): ArenaBlockApi {
    return {
      channels: (
        options?: PaginationAttributes,
      ): Effect.Effect<GetBlockChannelsApiResponse, HttpError> =>
        sdkEffect<GetBlockChannelsApiResponse>(() =>
          this.arena.blocks.connections(id, toConnectionsQuery(options)),
        ),
      get: sdkEffect<GetBlockApiResponse>(() => this.arena.blocks.get(id)),
      update: (data: {
        title?: string;
        description?: string;
        content?: string;
      }): Effect.Effect<void, HttpError> =>
        sdkEffect<void>(() => this.arena.blocks.update(id, data).then(() => undefined)),
      comments: (
        options?: PaginationAttributes,
      ): Effect.Effect<GetBlockCommentApiResponse, HttpError> =>
        sdkEffect<GetBlockCommentApiResponse>(() =>
          this.arena.blocks.comments(id, toConnectionsQuery(options)),
        ),
    };
  }

  get search(): ArenaSearchApi {
    return {
      everything: (
        query: string,
        options?: PaginationAttributes,
      ): Effect.Effect<SearchApiResponse, HttpError> =>
        sdkEffect<SearchApiResponse>(() =>
          this.arena.search.query(toSdkSearchQuery(query, undefined, options)),
        ),
      blocks: (
        query: string,
        options?: PaginationAttributes,
      ): Effect.Effect<SearchApiResponse, HttpError> =>
        sdkEffect<SearchApiResponse>(() =>
          this.arena.search.query(toSdkSearchQuery(query, "blocks", options)),
        ),
      channels: (
        query: string,
        options?: PaginationAttributes,
      ): Effect.Effect<SearchApiResponse, HttpError> =>
        sdkEffect<SearchApiResponse>(() =>
          this.arena.search.query(toSdkSearchQuery(query, "channels", options)),
        ),
      users: (
        query: string,
        options?: PaginationAttributes,
      ): Effect.Effect<SearchApiResponse, HttpError> =>
        sdkEffect<SearchApiResponse>(() =>
          this.arena.search.query(toSdkSearchQuery(query, "users", options)),
        ),
    };
  }

  private getJsonWithPaginationQuery<A, I>(
    url: string,
    options: PaginationAttributes | undefined,
    schema: Schema.Codec<A, I>,
  ): Effect.Effect<A, HttpError> {
    const qs = paginationQueryString(options, this.date);
    return this.makeRequest(`${url}?${qs}`, schema);
  }

  private makeRequest<A, I>(
    endpoint: string,
    schema: Schema.Codec<A, I>,
  ): Effect.Effect<A, HttpError> {
    const url = `${this.domain}${endpoint}`;
    const rawFetch = this.rawFetch;
    const headers = this.headers;

    return Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
        try: () =>
          rawFetch(url, {
            method: "GET",
            headers,
            body: null,
          }),
        catch: () =>
          new HttpError({
            message: "Network request failed",
            status: HttpStatus.BadGateway,
          }),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type") ?? "unknown";
        const contentLength = response.headers.get("content-length") ?? "unknown";
        const providerRequestId =
          response.headers.get("cf-ray") ?? response.headers.get("x-request-id") ?? undefined;
        const providerRequestIdField = providerRequestId
          ? ` providerRequestId=${providerRequestId}`
          : "";

        yield* Effect.logWarning(
          `[arena-diag] endpoint=${endpoint} status=${response.status} statusText=${response.statusText} contentType=${contentType} contentLength=${contentLength}${providerRequestIdField}`,
        );

        return yield* new HttpError({
          message: response.statusText,
          status: response.status,
        });
      }

      const json: unknown = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: () =>
          new HttpError({
            message: "Failed to parse JSON response",
            status: HttpStatus.InternalServerError,
          }),
      });

      return yield* Schema.decodeUnknownEffect(schema)(json).pipe(
        // A SchemaIssue has no useful `toString`, so `String(cause)` logged a
        // literal "undefined". Render it through Cause.pretty instead, which
        // is what makes this diagnostic worth having.
        Effect.tapError((issue) =>
          Effect.logWarning(
            `[arena-diag] endpoint=${endpoint} decode failed cause=${Cause.pretty(Cause.fail(issue))}`,
          ),
        ),
        Effect.mapError(
          (cause) =>
            new HttpError({
              message: "Unexpected are.na response",
              status: HttpStatus.BadGateway,
              cause,
            }),
        ),
      );
    });
  }
}

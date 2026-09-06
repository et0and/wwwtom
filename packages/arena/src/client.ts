import { Effect } from "effect";
import { createArena, ArenaApiError, ArenaNetworkError, type Arena } from "@aredotna/sdk";
import type {
  GetChannelsApiResponse,
  GetConnectionsApiResponse,
  MeApiResponse,
  PaginationAttributes,
  GetGroupApiResponse,
  GetGroupChannelsApiResponse,
  SearchApiResponse,
  GetBlockApiResponse,
  GetBlockChannelsApiResponse,
  CreateChannelApiResponse,
  GetChannelThumbApiResponse,
  GetChannelContentsApiResponse,
  GetUserChannelsApiResponse,
  GetUserApiResponse,
  GetUserFollowersApiResponse,
  GetUserFollowingApiResponse,
  GetBlockCommentApiResponse,
} from "@tom/schemas/arena";
import { HttpError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";

export interface ArenaBlockApi {
  get(): Effect.Effect<GetBlockApiResponse, HttpError>;
  channels(options?: PaginationAttributes): Effect.Effect<GetBlockChannelsApiResponse, HttpError>;
  update(data: {
    title?: string;
    description?: string;
    content?: string;
  }): Effect.Effect<void, HttpError>;
  comments(options?: PaginationAttributes): Effect.Effect<GetBlockCommentApiResponse, HttpError>;
}

export interface ArenaUserApi {
  get(): Effect.Effect<GetUserApiResponse, HttpError>;
  channels(options?: PaginationAttributes): Effect.Effect<GetUserChannelsApiResponse, HttpError>;
  following(): Effect.Effect<GetUserFollowingApiResponse, HttpError>;
  followers(): Effect.Effect<GetUserFollowersApiResponse, HttpError>;
}

export type ChannelStatus = "public" | "closed" | "private";

type ChannelUpdateBody = { title: string; visibility?: ChannelStatus };

export interface ArenaGroupApi {
  get(): Effect.Effect<GetGroupApiResponse, HttpError>;
  channels(options?: PaginationAttributes): Effect.Effect<GetGroupChannelsApiResponse, HttpError>;
}

export interface ArenaChannelApi {
  create(status?: ChannelStatus): Effect.Effect<CreateChannelApiResponse, HttpError>;
  get(options?: PaginationAttributes): Effect.Effect<GetChannelsApiResponse, HttpError>;
  delete(): Effect.Effect<void, HttpError>;
  update(data: { title: string; status?: ChannelStatus }): Effect.Effect<void, HttpError>;
  thumb(): Effect.Effect<GetChannelThumbApiResponse, HttpError>;
  contents(options?: PaginationAttributes): Effect.Effect<GetChannelContentsApiResponse, HttpError>;
  connections(
    options?: PaginationAttributes,
  ): Effect.Effect<GetConnectionsApiResponse[], HttpError>;
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
  me(): Effect.Effect<MeApiResponse, HttpError>;
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

/** Bridge SDK responses to local schema types in one place. */
const toLocal = <T>(promise: Promise<unknown>): Promise<T> => promise as Promise<T>;

const sdkEffect = <T>(run: () => Promise<unknown>): Effect.Effect<T, HttpError> =>
  Effect.tryPromise({ try: () => toLocal<T>(run()), catch: mapArenaError });

const formatSort = (sort?: string, direction?: string): string | undefined => {
  if (sort && direction) return `${sort}_${direction}`;
  if (sort) return sort;
  return undefined;
};

export type DateProvider = { now(): number };

export const defaultPaginationOptions: PaginationAttributes = {
  sort: "position",
  direction: "desc",
  per: 50,
};

export function paginationQueryString(
  options: PaginationAttributes | undefined,
  dateProvider: DateProvider,
): string {
  const { page, per, sort, direction, forceRefresh } = {
    ...defaultPaginationOptions,
    ...options,
  };
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

type SdkQuery = { page?: number; per?: number; sort?: string };

function toSdkQuery(options: PaginationAttributes | undefined): SdkQuery {
  const { page, per, sort, direction } = {
    ...defaultPaginationOptions,
    ...options,
  };
  const result: SdkQuery = {};
  if (page) result.page = page;
  if (per) result.per = per;
  const combined = formatSort(sort, direction);
  if (combined) result.sort = combined;
  return result;
}

type ArenaSearchQuery = {
  query: string;
  page?: number;
  per?: number;
  sort?: string;
  type?: Array<"User" | "Channel" | "Block">;
};

function toSdkSearchQuery(
  query: string,
  type: "users" | "channels" | "blocks" | undefined,
  options: PaginationAttributes | undefined,
): ArenaSearchQuery {
  const base = toSdkQuery(options);
  const result: ArenaSearchQuery = { query, ...base };
  if (type) {
    result.type = type === "users" ? ["User"] : type === "channels" ? ["Channel"] : ["Block"];
  }
  return result;
}

export class ArenaClient implements ArenaApi {
  private readonly domain: string;
  private readonly headers: Record<string, string>;
  private readonly rawFetch: Fetch;
  private readonly date: DateProvider;
  private readonly arena: Arena;

  private static normalizeToken(token?: string | null): string | null {
    if (token === null || token === undefined) return null;
    const normalized = token.trim();
    if (!normalized) return null;
    if (normalized === "undefined") return null;
    if (normalized === "null") return null;
    return normalized;
  }

  private static hasAuthorizationHeader(headers: HeadersInit | undefined): boolean {
    if (!headers) return false;
    if (headers instanceof Headers) return headers.has("Authorization");
    if (Array.isArray(headers)) return headers.some(([key]) => key === "Authorization");
    return "Authorization" in headers && Boolean(headers.Authorization);
  }

  private static removeAuthorizationHeader(
    headers: HeadersInit | undefined,
  ): HeadersInit | undefined {
    if (!headers) return undefined;
    if (headers instanceof Headers) {
      const h = new Headers(headers);
      h.delete("Authorization");
      return h;
    }
    if (Array.isArray(headers)) return headers.filter(([key]) => key !== "Authorization");
    const h = { ...headers };
    delete h.Authorization;
    return h;
  }

  private createCachedFetch(fetchImpl: Fetch): Fetch {
    return async (input, init) => {
      const url = input instanceof URL ? input.href : input instanceof Request ? input.url : input;
      const method = init?.method ?? "GET";
      const hasAuth = ArenaClient.hasAuthorizationHeader(init?.headers);
      const shouldUseEdgeCache = method === "GET" && !hasAuth;

      const requestInit = (
        shouldUseEdgeCache
          ? {
              ...init,
              cf: {
                cacheTtl: 86400,
                cacheKey: `arena:v3:public:${url}`,
                cacheTtlByStatus: { "400-599": 0 },
              },
            }
          : { ...init, cf: { cacheTtl: 0 } }
      ) as NonNullable<Parameters<Fetch>[1]>;

      const response = await fetchImpl(input, requestInit);

      const shouldRetryWithoutAuth =
        method === "GET" && hasAuth && (response.status === 401 || response.status === 403);

      if (shouldRetryWithoutAuth) {
        const retryInit = { ...requestInit };
        const retryHeaders = ArenaClient.removeAuthorizationHeader(requestInit.headers);
        if (retryHeaders) retryInit.headers = retryHeaders;
        return fetchImpl(input, retryInit);
      }

      return response;
    };
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
    this.arena = createArena({
      fetch: wrappedFetch as typeof fetch,
      baseUrl: config?.baseUrl ?? "https://api.are.na",
      ...(normalizedToken && { token: normalizedToken }),
    });
  }

  me(): Effect.Effect<MeApiResponse, HttpError> {
    return sdkEffect<MeApiResponse>(() => this.arena.me());
  }

  channels(options?: PaginationAttributes): Effect.Effect<GetChannelsApiResponse, HttpError> {
    return this.getJsonWithPaginationQuery("channels", options);
  }

  user(id: number | string): ArenaUserApi {
    return {
      get: (): Effect.Effect<GetUserApiResponse, HttpError> =>
        sdkEffect<GetUserApiResponse>(() => this.arena.users.get(id)),
      channels: (
        options?: PaginationAttributes,
      ): Effect.Effect<GetUserChannelsApiResponse, HttpError> =>
        this.getJsonWithPaginationQuery(`users/${id}/channels`, options),
      following: (): Effect.Effect<GetUserFollowingApiResponse, HttpError> =>
        sdkEffect<GetUserFollowingApiResponse>(() => this.arena.users.following(id)),
      followers: (): Effect.Effect<GetUserFollowersApiResponse, HttpError> =>
        sdkEffect<GetUserFollowersApiResponse>(() => this.arena.users.followers(id)),
    };
  }

  group(slug: string): ArenaGroupApi {
    return {
      get: (): Effect.Effect<GetGroupApiResponse, HttpError> =>
        sdkEffect<GetGroupApiResponse>(() => this.arena.groups.get(slug)),
      channels: (
        options?: PaginationAttributes,
      ): Effect.Effect<GetGroupChannelsApiResponse, HttpError> =>
        this.getJsonWithPaginationQuery(`groups/${slug}/channels`, options),
    };
  }

  channel(slug: string): ArenaChannelApi {
    return {
      contents: (
        options?: PaginationAttributes,
      ): Effect.Effect<GetChannelContentsApiResponse, HttpError> =>
        sdkEffect<GetChannelContentsApiResponse>(() =>
          this.arena.channels.contents(slug, toSdkQuery(options) as any),
        ),
      connections: (
        options?: PaginationAttributes,
      ): Effect.Effect<GetConnectionsApiResponse[], HttpError> =>
        sdkEffect<GetConnectionsApiResponse[]>(() =>
          this.arena.channels.connections(slug, toSdkQuery(options) as any),
        ),
      create: (status?: ChannelStatus): Effect.Effect<CreateChannelApiResponse, HttpError> =>
        sdkEffect<CreateChannelApiResponse>(() =>
          this.arena.channels.create({
            title: slug,
            visibility: status as "public" | "private" | "closed",
          } as any),
        ),
      update: (data: { title: string; status?: ChannelStatus }): Effect.Effect<void, HttpError> =>
        sdkEffect<void>(() => {
          const body: ChannelUpdateBody = { title: data.title };
          if (data.status) body.visibility = data.status;
          return this.arena.channels.update(slug, body as any);
        }),
      get: (options?: PaginationAttributes): Effect.Effect<GetChannelsApiResponse, HttpError> =>
        sdkEffect<GetChannelsApiResponse>(() =>
          this.arena.channels.get(slug, toSdkQuery(options) as any),
        ),
      delete: (): Effect.Effect<void, HttpError> =>
        sdkEffect<void>(() => this.arena.channels.delete(slug)),
      thumb: (): Effect.Effect<GetChannelThumbApiResponse, HttpError> =>
        this.getJson(`channels/${slug}/thumb`),
    };
  }

  block(id: number): ArenaBlockApi {
    return {
      channels: (
        options?: PaginationAttributes,
      ): Effect.Effect<GetBlockChannelsApiResponse, HttpError> =>
        sdkEffect<GetBlockChannelsApiResponse>(() =>
          this.arena.blocks.connections(id, toSdkQuery(options) as any),
        ),
      get: (): Effect.Effect<GetBlockApiResponse, HttpError> =>
        sdkEffect<GetBlockApiResponse>(() => this.arena.blocks.get(id)),
      update: (data: {
        title?: string;
        description?: string;
        content?: string;
      }): Effect.Effect<void, HttpError> =>
        sdkEffect<void>(() => this.arena.blocks.update(id, data as any)),
      comments: (
        options?: PaginationAttributes,
      ): Effect.Effect<GetBlockCommentApiResponse, HttpError> =>
        sdkEffect<GetBlockCommentApiResponse>(() =>
          this.arena.blocks.comments(id, toSdkQuery(options) as any),
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
          this.arena.search.query(toSdkSearchQuery(query, undefined, options) as any),
        ),
      blocks: (
        query: string,
        options?: PaginationAttributes,
      ): Effect.Effect<SearchApiResponse, HttpError> =>
        sdkEffect<SearchApiResponse>(() =>
          this.arena.search.query(toSdkSearchQuery(query, "blocks", options) as any),
        ),
      channels: (
        query: string,
        options?: PaginationAttributes,
      ): Effect.Effect<SearchApiResponse, HttpError> =>
        sdkEffect<SearchApiResponse>(() =>
          this.arena.search.query(toSdkSearchQuery(query, "channels", options) as any),
        ),
      users: (
        query: string,
        options?: PaginationAttributes,
      ): Effect.Effect<SearchApiResponse, HttpError> =>
        sdkEffect<SearchApiResponse>(() =>
          this.arena.search.query(toSdkSearchQuery(query, "users", options) as any),
        ),
    };
  }

  private getJsonWithPaginationQuery<T>(
    url: string,
    options?: PaginationAttributes,
  ): Effect.Effect<T, HttpError> {
    const qs = paginationQueryString(options, this.date);
    return this.getJson<T>(`${url}?${qs}`);
  }

  private makeRequest<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE",
  ): Effect.Effect<T, HttpError> {
    const url = `${this.domain}${endpoint}`;
    const rawFetch = this.rawFetch;
    const headers = this.headers;

    return Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
        try: () =>
          rawFetch(url, {
            method,
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
          `[arena-diag] method=${method} endpoint=${endpoint} status=${response.status} statusText=${response.statusText} contentType=${contentType} contentLength=${contentLength}${providerRequestIdField}`,
        );

        return yield* new HttpError({
          message: response.statusText,
          status: response.status,
        });
      }

      if (method === "DELETE" || method === "PUT") {
        return undefined as T;
      }

      const json = yield* Effect.tryPromise({
        try: () => response.json() as Promise<T>,
        catch: () =>
          new HttpError({
            message: "Failed to parse JSON response",
            status: HttpStatus.InternalServerError,
          }),
      });

      return json;
    });
  }

  private getJson<T>(endpoint: string): Effect.Effect<T, HttpError> {
    return this.makeRequest<T>(endpoint, "GET");
  }
}

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
  // Arena API expects combined sort value: "position_desc", "created_at_asc", etc.
  if (sort && direction) {
    attrs.push(`sort=${sort}_${direction}`);
  } else if (sort) {
    attrs.push(`sort=${sort}`);
  }
  if (forceRefresh) attrs.push(`date=${dateProvider.now()}`);
  return attrs.join("&");
}

function mapArenaError(error: unknown): HttpError {
  if (error instanceof ArenaApiError) {
    return new HttpError({ message: error.message, status: error.status });
  }
  if (error instanceof ArenaNetworkError) {
    return new HttpError({ message: error.message, status: 0 });
  }
  return new HttpError({
    message: error instanceof Error ? error.message : String(error),
    status: HttpStatus.InternalServerError,
  });
}

function toSdkQuery(options: PaginationAttributes | undefined): {
  page?: number;
  per?: number;
  sort?: string;
} {
  const { page, per, sort, direction } = {
    ...defaultPaginationOptions,
    ...options,
  };
  const result: { page?: number; per?: number; sort?: string } = {};
  if (page) result.page = page;
  if (per) result.per = per;
  if (sort && direction) {
    result.sort = `${sort}_${direction}`;
  } else if (sort) {
    result.sort = sort;
  }
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
    if (typeof token !== "string") return null;
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
    const h = { ...headers } as Record<string, string>;
    delete h.Authorization;
    return h;
  }

  private createCachedFetch(fetchImpl: Fetch): Fetch {
    return async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
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
      ...(normalizedToken ? { Authorization: `Bearer ${normalizedToken}` } : {}),
    };
    const wrappedFetch = this.createCachedFetch(config?.fetch || fetch.bind(globalThis));
    this.rawFetch = wrappedFetch;
    this.date = config?.date || Date;
    this.arena = createArena({
      fetch: wrappedFetch as typeof fetch,
      baseUrl: config?.baseUrl ?? "https://api.are.na",
      ...(normalizedToken ? { token: normalizedToken } : {}),
    });
  }

  me(): Effect.Effect<MeApiResponse, HttpError> {
    return Effect.tryPromise({
      try: () => this.arena.me() as unknown as Promise<MeApiResponse>,
      catch: mapArenaError,
    });
  }

  channels(options?: PaginationAttributes): Effect.Effect<GetChannelsApiResponse, HttpError> {
    return this.getJsonWithPaginationQuery("channels", options);
  }

  user(id: number | string): ArenaUserApi {
    return {
      get: (): Effect.Effect<GetUserApiResponse, HttpError> =>
        Effect.tryPromise({
          try: () => this.arena.users.get(id) as unknown as Promise<GetUserApiResponse>,
          catch: mapArenaError,
        }),
      channels: (
        options?: PaginationAttributes,
      ): Effect.Effect<GetUserChannelsApiResponse, HttpError> =>
        this.getJsonWithPaginationQuery(`users/${id}/channels`, options),
      following: (): Effect.Effect<GetUserFollowingApiResponse, HttpError> =>
        Effect.tryPromise({
          try: () =>
            this.arena.users.following(id) as unknown as Promise<GetUserFollowingApiResponse>,
          catch: mapArenaError,
        }),
      followers: (): Effect.Effect<GetUserFollowersApiResponse, HttpError> =>
        Effect.tryPromise({
          try: () =>
            this.arena.users.followers(id) as unknown as Promise<GetUserFollowersApiResponse>,
          catch: mapArenaError,
        }),
    };
  }

  group(slug: string): ArenaGroupApi {
    return {
      get: (): Effect.Effect<GetGroupApiResponse, HttpError> =>
        Effect.tryPromise({
          try: () => this.arena.groups.get(slug) as unknown as Promise<GetGroupApiResponse>,
          catch: mapArenaError,
        }),
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
        Effect.tryPromise({
          try: () =>
            this.arena.channels.contents(
              slug,
              toSdkQuery(options) as any,
            ) as unknown as Promise<GetChannelContentsApiResponse>,
          catch: mapArenaError,
        }),
      connections: (
        options?: PaginationAttributes,
      ): Effect.Effect<GetConnectionsApiResponse[], HttpError> =>
        Effect.tryPromise({
          try: () =>
            this.arena.channels.connections(slug, toSdkQuery(options) as any) as unknown as Promise<
              GetConnectionsApiResponse[]
            >,
          catch: mapArenaError,
        }),
      create: (status?: ChannelStatus): Effect.Effect<CreateChannelApiResponse, HttpError> =>
        Effect.tryPromise({
          try: () =>
            this.arena.channels.create({
              title: slug,
              visibility: status as "public" | "private" | "closed",
            } as any) as unknown as Promise<CreateChannelApiResponse>,
          catch: mapArenaError,
        }),
      update: (data: { title: string; status?: ChannelStatus }): Effect.Effect<void, HttpError> =>
        Effect.tryPromise({
          try: () => {
            const body: { title: string; visibility?: ChannelStatus } = { title: data.title };
            if (data.status) body.visibility = data.status;
            return this.arena.channels.update(slug, body as any) as unknown as Promise<void>;
          },
          catch: mapArenaError,
        }),
      get: (options?: PaginationAttributes): Effect.Effect<GetChannelsApiResponse, HttpError> =>
        Effect.tryPromise({
          try: () =>
            this.arena.channels.get(
              slug,
              toSdkQuery(options) as any,
            ) as unknown as Promise<GetChannelsApiResponse>,
          catch: mapArenaError,
        }),
      delete: (): Effect.Effect<void, HttpError> =>
        Effect.tryPromise({
          try: () => this.arena.channels.delete(slug) as unknown as Promise<void>,
          catch: mapArenaError,
        }),
      thumb: (): Effect.Effect<GetChannelThumbApiResponse, HttpError> =>
        this.getJson(`channels/${slug}/thumb`),
    };
  }

  block(id: number): ArenaBlockApi {
    return {
      channels: (
        options?: PaginationAttributes,
      ): Effect.Effect<GetBlockChannelsApiResponse, HttpError> =>
        Effect.tryPromise({
          try: () =>
            this.arena.blocks.connections(
              id,
              toSdkQuery(options) as any,
            ) as unknown as Promise<GetBlockChannelsApiResponse>,
          catch: mapArenaError,
        }),
      get: (): Effect.Effect<GetBlockApiResponse, HttpError> =>
        Effect.tryPromise({
          try: () => this.arena.blocks.get(id) as unknown as Promise<GetBlockApiResponse>,
          catch: mapArenaError,
        }),
      update: (data: {
        title?: string;
        description?: string;
        content?: string;
      }): Effect.Effect<void, HttpError> =>
        Effect.tryPromise({
          try: () => this.arena.blocks.update(id, data as any) as unknown as Promise<void>,
          catch: mapArenaError,
        }),
      comments: (
        options?: PaginationAttributes,
      ): Effect.Effect<GetBlockCommentApiResponse, HttpError> =>
        Effect.tryPromise({
          try: () =>
            this.arena.blocks.comments(
              id,
              toSdkQuery(options) as any,
            ) as unknown as Promise<GetBlockCommentApiResponse>,
          catch: mapArenaError,
        }),
    };
  }

  get search(): ArenaSearchApi {
    return {
      everything: (
        query: string,
        options?: PaginationAttributes,
      ): Effect.Effect<SearchApiResponse, HttpError> =>
        Effect.tryPromise({
          try: () =>
            this.arena.search.query(
              toSdkSearchQuery(query, undefined, options) as any,
            ) as unknown as Promise<SearchApiResponse>,
          catch: mapArenaError,
        }),
      blocks: (
        query: string,
        options?: PaginationAttributes,
      ): Effect.Effect<SearchApiResponse, HttpError> =>
        Effect.tryPromise({
          try: () =>
            this.arena.search.query(
              toSdkSearchQuery(query, "blocks", options) as any,
            ) as unknown as Promise<SearchApiResponse>,
          catch: mapArenaError,
        }),
      channels: (
        query: string,
        options?: PaginationAttributes,
      ): Effect.Effect<SearchApiResponse, HttpError> =>
        Effect.tryPromise({
          try: () =>
            this.arena.search.query(
              toSdkSearchQuery(query, "channels", options) as any,
            ) as unknown as Promise<SearchApiResponse>,
          catch: mapArenaError,
        }),
      users: (
        query: string,
        options?: PaginationAttributes,
      ): Effect.Effect<SearchApiResponse, HttpError> =>
        Effect.tryPromise({
          try: () =>
            this.arena.search.query(
              toSdkSearchQuery(query, "users", options) as any,
            ) as unknown as Promise<SearchApiResponse>,
          catch: mapArenaError,
        }),
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
    data?: unknown,
  ): Effect.Effect<T, HttpError> {
    const url = `${this.domain}${endpoint}`;
    const isGet = method === "GET";
    const rawFetch = this.rawFetch;
    const headers = this.headers;

    return Effect.gen(function* () {
      const response = yield* Effect.tryPromise({
        try: () =>
          rawFetch(url, {
            method,
            headers,
            body: data && !isGet ? JSON.stringify(data) : null,
          }),
        catch: () => new HttpError({ message: "Network request failed", status: 0 }),
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

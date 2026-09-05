import { Effect } from "effect";
import {
  createArena,
  ArenaApiError,
  ArenaNetworkError,
  type Arena,
  type Channel,
} from "@aredotna/sdk";
import type {
  GetChannelsApiResponse,
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
  get(): Effect.Effect<Channel, HttpError>;
  delete(): Effect.Effect<void, HttpError>;
  update(data: { title: string; status?: ChannelStatus }): Effect.Effect<void, HttpError>;
  thumb(): Effect.Effect<GetChannelThumbApiResponse, HttpError>;
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

/** Run an SDK promise as an Effect, mapping SDK errors to HttpError. */
const sdkEffect = <T>(run: () => Promise<T>): Effect.Effect<T, HttpError> =>
  Effect.tryPromise({ try: run, catch: mapArenaError });

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

type ContentsQuery = NonNullable<Parameters<Arena["channels"]["contents"]>[1]>;
type ChannelConnections = Awaited<ReturnType<Arena["channels"]["connections"]>>;
type ConnectionsQuery = NonNullable<Parameters<Arena["channels"]["connections"]>[1]>;
type BlockConnectionsQuery = NonNullable<Parameters<Arena["blocks"]["connections"]>[1]>;
type BlockCommentsQuery = NonNullable<Parameters<Arena["blocks"]["comments"]>[1]>;
type SearchQuery = NonNullable<Parameters<Arena["search"]["query"]>[0]>;

interface PageParams {
  page?: number;
  per?: number;
}

const pageParams = (options: PaginationAttributes | undefined): PageParams => {
  const { page, per } = { ...defaultPaginationOptions, ...options };
  return {
    ...(page !== undefined && { page }),
    ...(per !== undefined && { per }),
  };
};

const toContentsSort = (sort?: string, direction?: string): ContentsQuery["sort"] => {
  const combined = formatSort(sort, direction);
  if (
    combined === "position_asc" ||
    combined === "position_desc" ||
    combined === "created_at_asc" ||
    combined === "created_at_desc" ||
    combined === "updated_at_asc" ||
    combined === "updated_at_desc"
  ) {
    return combined;
  }
  return undefined;
};

const toConnectionsSort = (sort?: string, direction?: string): ConnectionsQuery["sort"] => {
  const combined = formatSort(sort, direction);
  if (combined === "created_at_asc" || combined === "created_at_desc") return combined;
  return undefined;
};

const toSearchSort = (sort?: string, direction?: string): SearchQuery["sort"] => {
  const combined = formatSort(sort, direction);
  if (
    combined === "score_desc" ||
    combined === "created_at_asc" ||
    combined === "created_at_desc" ||
    combined === "updated_at_asc" ||
    combined === "updated_at_desc" ||
    combined === "name_asc" ||
    combined === "name_desc" ||
    combined === "connections_count_desc"
  ) {
    return combined;
  }
  return undefined;
};

function toContentsQuery(options: PaginationAttributes | undefined): ContentsQuery {
  const { sort, direction } = { ...defaultPaginationOptions, ...options };
  const result: ContentsQuery = { ...pageParams(options) };
  const sortParam = toContentsSort(sort, direction);
  if (sortParam !== undefined) result.sort = sortParam;
  return result;
}

function toConnectionsQuery(options: PaginationAttributes | undefined): ConnectionsQuery {
  const { sort, direction } = { ...defaultPaginationOptions, ...options };
  const result: ConnectionsQuery = { ...pageParams(options) };
  const sortParam = toConnectionsSort(sort, direction);
  if (sortParam !== undefined) result.sort = sortParam;
  return result;
}

function toBlockConnectionsQuery(options: PaginationAttributes | undefined): BlockConnectionsQuery {
  const { sort, direction } = { ...defaultPaginationOptions, ...options };
  const result: BlockConnectionsQuery = { ...pageParams(options) };
  const sortParam = toConnectionsSort(sort, direction);
  if (sortParam !== undefined) result.sort = sortParam;
  return result;
}

function toBlockCommentsQuery(options: PaginationAttributes | undefined): BlockCommentsQuery {
  const { sort, direction } = { ...defaultPaginationOptions, ...options };
  const result: BlockCommentsQuery = { ...pageParams(options) };
  const sortParam = toConnectionsSort(sort, direction);
  if (sortParam !== undefined) result.sort = sortParam;
  return result;
}

function toSdkSearchQuery(
  query: string,
  type: "users" | "channels" | "blocks" | undefined,
  options: PaginationAttributes | undefined,
): SearchQuery {
  const { sort, direction } = { ...defaultPaginationOptions, ...options };
  const result: SearchQuery = { query, ...pageParams(options) };
  const sortParam = toSearchSort(sort, direction);
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

      const requestInit: NonNullable<Parameters<Fetch>[1]> = shouldUseEdgeCache
        ? {
            ...init,
            cf: {
              cacheTtl: 86400,
              cacheKey: `arena:v3:public:${url}`,
              cacheTtlByStatus: { "400-599": 0 },
            },
          }
        : { ...init, cf: { cacheTtl: 0 } };

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
    const sdkFetch: typeof fetch = (input, init) =>
      wrappedFetch(input instanceof URL ? input.href : input, init);
    this.arena = createArena({
      fetch: sdkFetch,
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
          this.arena.channels.contents(slug, toContentsQuery(options)),
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
      get: (): Effect.Effect<Channel, HttpError> =>
        sdkEffect<Channel>(() => this.arena.channels.get(slug)),
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
          this.arena.blocks.connections(id, toBlockConnectionsQuery(options)),
        ),
      get: (): Effect.Effect<GetBlockApiResponse, HttpError> =>
        sdkEffect<GetBlockApiResponse>(() => this.arena.blocks.get(id)),
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
          this.arena.blocks.comments(id, toBlockCommentsQuery(options)),
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

  private getJsonWithPaginationQuery<T>(
    url: string,
    options?: PaginationAttributes,
  ): Effect.Effect<T, HttpError> {
    const qs = paginationQueryString(options, this.date);
    return this.getJson<T>(`${url}?${qs}`);
  }

  private makeRequest<T>(endpoint: string): Effect.Effect<T, HttpError> {
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

      const json: T = yield* Effect.tryPromise({
        try: () => response.json(),
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
    return this.makeRequest<T>(endpoint);
  }
}

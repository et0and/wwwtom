import { Context, Effect, Layer, Redacted } from "effect";
import { AppConfig } from "@tom/utils/services";
import { retryPolicy } from "@tom/utils/retry";
import type { PayloadPost, PayloadResponse } from "@tom/schemas";

// =============================================================================
// PayloadService - Effect Service Pattern
// =============================================================================

export class PayloadError extends Error {
  readonly _tag = "PayloadError";
  constructor(
    message: string,
    readonly endpoint?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PayloadError";
  }
}

export interface PayloadServiceShape {
  /**
   * Fetch data from a Payload endpoint with optional caching
   */
  readonly fetch: <T>(
    endpoint: string,
    options?: RequestInit & { useCache?: boolean; cacheTTL?: number },
  ) => Effect.Effect<T, PayloadError>;

  /**
   * Fetch posts
   */
  readonly getPosts: (params?: {
    limit?: number;
    page?: number;
    where?: Record<string, unknown>;
    sort?: string;
  }) => Effect.Effect<PayloadResponse<PayloadPost>, PayloadError>;

  /**
   * Fetch a single post by slug
   */
  readonly getPostBySlug: (slug: string) => Effect.Effect<PayloadPost | null, PayloadError>;

  /**
   * Fetch works
   */
  readonly getWorks: (params?: {
    limit?: number;
    page?: number;
    where?: Record<string, unknown>;
    sort?: string;
  }) => Effect.Effect<PayloadResponse<PayloadPost>, PayloadError>;

  /**
   * Fetch a single work by slug
   */
  readonly getWorkBySlug: (slug: string) => Effect.Effect<PayloadPost | null, PayloadError>;
}

export class PayloadService extends Context.Tag("PayloadService")<
  PayloadService,
  PayloadServiceShape
>() {}

// Build query string from params
const buildQuery = (params?: {
  limit?: number;
  page?: number;
  where?: Record<string, unknown>;
  sort?: string;
}): string => {
  if (!params) return "";

  const searchParams = new URLSearchParams();

  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.page) searchParams.set("page", String(params.page));
  if (params.sort) searchParams.set("sort", params.sort);
  if (params.where) {
    searchParams.set("where", JSON.stringify(params.where));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

export const PayloadServiceLive = Layer.effect(
  PayloadService,
  Effect.gen(function* () {
    const config = yield* AppConfig;
    const baseUrl = Redacted.value(config.payloadUrl);

    if (!baseUrl) {
      return yield* Effect.fail(new PayloadError("Payload URL not configured"));
    }

    const doFetch = <T>(
      endpoint: string,
      options?: RequestInit & { useCache?: boolean; cacheTTL?: number },
    ): Effect.Effect<T, PayloadError> =>
      Effect.gen(function* () {
        const url = `${baseUrl}/api${endpoint}`;

        const headers: HeadersInit = {
          "Content-Type": "application/json",
          Origin: baseUrl.replace("/api", ""),
          Referer: baseUrl.replace("/api", ""),
          ...options?.headers,
        };

        yield* Effect.logDebug(`Fetching Payload: ${url}`);

        let response: Response;

        if (options?.useCache) {
          const cacheResult = yield* Effect.tryPromise({
            try: async () => (await caches.open("payload-cache")) as Cache | null,
            catch: () => null,
          }).pipe(Effect.catchAll(() => Effect.succeed(null)));

          if (cacheResult) {
            const cacheReq = new Request(url);
            const cached = yield* Effect.tryPromise({
              try: async () => await cacheResult.match(cacheReq),
              catch: () => null,
            }).pipe(Effect.catchAll(() => Effect.succeed(null as Response | null)));

            if (cached) {
              yield* Effect.logDebug(`Cache hit: ${url}`);
              response = cached;
            } else {
              yield* Effect.logDebug(`Cache miss: ${url}`);
              response = yield* Effect.tryPromise({
                try: () => fetch(url, { ...options, headers }),
                catch: (e) =>
                  new PayloadError(e instanceof Error ? e.message : "Fetch error", endpoint),
              });

              if (response.ok) {
                const clone = response.clone();
                yield* Effect.tryPromise({
                  try: async () => await cacheResult.put(cacheReq, clone),
                  catch: () => null,
                }).pipe(Effect.catchAll(() => Effect.void));
              }
            }
          } else {
            response = yield* Effect.tryPromise({
              try: () => fetch(url, { ...options, headers }),
              catch: (e) =>
                new PayloadError(e instanceof Error ? e.message : "Fetch error", endpoint),
            });
          }
        } else {
          response = yield* Effect.tryPromise({
            try: () => fetch(url, { ...options, headers }),
            catch: (e) =>
              new PayloadError(e instanceof Error ? e.message : "Fetch error", endpoint),
          });
        }

        if (!response.ok) {
          return yield* Effect.fail(
            new PayloadError(
              `Payload API error: ${response.status} ${response.statusText}`,
              endpoint,
              response.status,
            ),
          );
        }

        const data = yield* Effect.tryPromise({
          try: () => response.json(),
          catch: (e) =>
            new PayloadError(e instanceof Error ? e.message : "JSON parse error", endpoint),
        });

        return data as T;
      }).pipe(Effect.retry(retryPolicy));

    const service: PayloadServiceShape = {
      fetch: doFetch,

      getPosts: (params) => {
        const endpoint = `/posts${buildQuery(params)}`;
        return doFetch<PayloadResponse<PayloadPost>>(endpoint, { useCache: true });
      },

      getPostBySlug: (slug) =>
        Effect.gen(function* () {
          const endpoint = `/posts?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`;
          const data = yield* doFetch<PayloadResponse<PayloadPost>>(endpoint, {
            useCache: true,
          });

          if (!data.docs || data.docs.length === 0) {
            return null;
          }

          return data.docs[0] ?? null;
        }),

      getWorks: (params) => {
        const endpoint = `/works${buildQuery(params)}`;
        return doFetch<PayloadResponse<PayloadPost>>(endpoint, { useCache: true });
      },

      getWorkBySlug: (slug) =>
        Effect.gen(function* () {
          const endpoint = `/works?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`;
          const data = yield* doFetch<PayloadResponse<PayloadPost>>(endpoint, {
            useCache: true,
          });

          if (!data.docs || data.docs.length === 0) {
            return null;
          }

          return data.docs[0] ?? null;
        }),
    };

    return service;
  }),
);

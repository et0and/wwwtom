import { Context, Effect, Layer, Redacted } from "effect";
import { AppConfig } from "@tom/utils/services";
import { retryPolicy } from "@tom/utils/retry";
import type { PayloadPost, PayloadResponse } from "@tom/schemas";

const cacheExpiryHeader = "x-payload-cache-expires-at";

const getCacheExpiryTimestamp = (response: Response): number | null => {
  const cacheExpiryValue = response.headers.get(cacheExpiryHeader);
  if (!cacheExpiryValue) return null;

  const cacheExpiryTimestamp = Number(cacheExpiryValue);
  if (!Number.isFinite(cacheExpiryTimestamp)) return null;

  return cacheExpiryTimestamp;
};

const hasExpiredCacheEntry = (response: Response, cacheTTL?: number): boolean => {
  if (!cacheTTL || cacheTTL <= 0) return false;

  const cacheExpiryTimestamp = getCacheExpiryTimestamp(response);
  if (cacheExpiryTimestamp === null) return true;

  return cacheExpiryTimestamp <= Date.now();
};

const withCacheMetadata = (response: Response, cacheTTL?: number): Response => {
  const headers = new Headers(response.headers);

  if (cacheTTL && cacheTTL > 0) {
    headers.set(cacheExpiryHeader, String(Date.now() + cacheTTL * 1000));
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

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
    sort?: string;
  }) => Effect.Effect<PayloadResponse<PayloadPost>, PayloadError>;

  /**
   * Fetch a single work by slug
   */
  readonly getWorkBySlug: (slug: string) => Effect.Effect<PayloadPost | null, PayloadError>;
}

// Build query string from params
const buildQuery = (params?: { limit?: number; page?: number; sort?: string }): string => {
  if (!params) return "";

  const searchParams = new URLSearchParams();

  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.page) searchParams.set("page", String(params.page));
  if (params.sort) searchParams.set("sort", params.sort);

  const query = searchParams.toString();
  return query ? `?${query}` : "";
};

export class PayloadService extends Context.Service<PayloadService, PayloadServiceShape>()(
  "PayloadService",
) {
  static readonly Default = Layer.effect(
    PayloadService,
    Effect.gen(function* () {
      const config = yield* AppConfig;
      const baseUrl = Redacted.value(config.payloadUrl);

      if (!baseUrl) {
        return yield* Effect.fail(new PayloadError("Payload URL not configured"));
      }

      const doFetch = Effect.fn("PayloadService.fetch")(
        <T>(
          endpoint: string,
          options?: RequestInit & { useCache?: boolean; cacheTTL?: number },
        ): Effect.Effect<T, PayloadError> =>
          Effect.gen(function* () {
            const url = `${baseUrl}/api${endpoint}`;
            const fetchResponse = () =>
              Effect.tryPromise({
                try: () => fetch(url, { ...options, headers }),
                catch: (e) =>
                  new PayloadError(e instanceof Error ? e.message : "Fetch error", endpoint),
              });

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
              }).pipe(Effect.orElseSucceed(() => null));

              if (cacheResult) {
                const cacheReq = new Request(url);
                const cached = yield* Effect.tryPromise({
                  try: async () => await cacheResult.match(cacheReq),
                  catch: () => null,
                }).pipe(Effect.orElseSucceed(() => null));

                if (cached && !hasExpiredCacheEntry(cached, options.cacheTTL)) {
                  yield* Effect.logDebug(`Cache hit: ${url}`);
                  response = cached;
                } else {
                  if (cached) {
                    yield* Effect.logDebug(`Cache stale: ${url}`);
                  }

                  yield* Effect.logDebug(`Cache miss: ${url}`);
                  response = yield* fetchResponse();

                  if (response.ok) {
                    const clone = response.clone();
                    const responseWithCacheMetadata = withCacheMetadata(clone, options.cacheTTL);
                    yield* Effect.tryPromise({
                      try: async () => await cacheResult.put(cacheReq, responseWithCacheMetadata),
                      catch: () => null,
                    }).pipe(Effect.orElseSucceed(() => undefined));
                  }
                }
              } else {
                response = yield* fetchResponse();
              }
            } else {
              response = yield* fetchResponse();
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
          }).pipe(Effect.retry(retryPolicy)),
      );

      const service: PayloadServiceShape = {
        fetch: doFetch,

        getPosts: (params) => {
          const endpoint = `/posts${buildQuery(params)}`;
          return doFetch<PayloadResponse<PayloadPost>>(endpoint, {
            useCache: true,
          });
        },

        getPostBySlug: Effect.fn("PayloadService.getPostBySlug")(function* (slug: string) {
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
          return doFetch<PayloadResponse<PayloadPost>>(endpoint, {
            useCache: true,
          });
        },

        getWorkBySlug: Effect.fn("PayloadService.getWorkBySlug")(function* (slug: string) {
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
}

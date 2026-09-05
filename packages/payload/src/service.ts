import { Context, Effect, Layer, Option, Redacted, Schema } from "effect";
import { AppConfig } from "@tom/utils/services/config";
import { retryPolicy } from "@tom/utils/retry";
import {
  PayloadPostSchema,
  PayloadResponseSchema,
  PayloadWorkSchema,
  type PayloadPost,
  type PayloadResponse,
  type PayloadWork,
} from "@tom/schemas/payload";

const cacheExpiryHeader = "x-payload-cache-expires-at";

const getCacheExpiryTimestamp = (response: Response): number | null =>
  Option.getOrNull(
    Option.filter(
      Schema.decodeUnknownOption(Schema.NumberFromString)(
        response.headers.get(cacheExpiryHeader) ?? "",
      ),
      Number.isFinite,
    ),
  );

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

const fetchWithCache = (
  url: string,
  cacheTTL: number | undefined,
  fetchResponse: () => Effect.Effect<Response, PayloadError>,
): Effect.Effect<Response, PayloadError> =>
  Effect.gen(function* () {
    const cache = yield* Effect.tryPromise({
      try: () => caches.open("payload-cache"),
      catch: () => null,
    }).pipe(Effect.orElseSucceed(() => null));

    if (!cache) return yield* fetchResponse();

    const cacheReq = new Request(url);
    const cached = yield* Effect.tryPromise({
      try: () => cache.match(cacheReq),
      catch: () => null,
    }).pipe(Effect.orElseSucceed(() => null));

    if (cached && !hasExpiredCacheEntry(cached, cacheTTL)) {
      yield* Effect.logDebug(`Cache hit: ${url}`);
      return cached;
    }

    if (cached) yield* Effect.logDebug(`Cache stale: ${url}`);
    yield* Effect.logDebug(`Cache miss: ${url}`);
    const response = yield* fetchResponse();

    if (response.ok) {
      const responseWithCacheMetadata = withCacheMetadata(response.clone(), cacheTTL);
      yield* Effect.tryPromise({
        try: () => cache.put(cacheReq, responseWithCacheMetadata),
        catch: () => null,
      }).pipe(Effect.orElseSucceed(() => undefined));
    }

    return response;
  });

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

export interface PayloadServiceContract {
  /**
   * Fetch data from a Payload endpoint with optional caching, validating
   * the response against the given schema.
   */
  readonly fetch: <A, I, R>(
    endpoint: string,
    schema: Schema.Codec<A, I, R>,
    options?: RequestInit & { useCache?: boolean; cacheTTL?: number },
  ) => Effect.Effect<A, PayloadError, R>;

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
  }) => Effect.Effect<PayloadResponse<PayloadWork>, PayloadError>;

  /**
   * Fetch a single work by slug
   */
  readonly getWorkBySlug: (slug: string) => Effect.Effect<PayloadWork | null, PayloadError>;
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

export class PayloadService extends Context.Service<PayloadService, PayloadServiceContract>()(
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
        <A, I, R>(
          endpoint: string,
          schema: Schema.Codec<A, I, R>,
          options?: RequestInit & { useCache?: boolean; cacheTTL?: number },
        ): Effect.Effect<A, PayloadError, R> =>
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

            const response = options?.useCache
              ? yield* fetchWithCache(url, options.cacheTTL, fetchResponse)
              : yield* fetchResponse();

            if (!response.ok) {
              return yield* Effect.fail(
                new PayloadError(
                  `Payload API error: ${response.status} ${response.statusText}`,
                  endpoint,
                  response.status,
                ),
              );
            }

            const json: unknown = yield* Effect.tryPromise({
              try: () => response.json(),
              catch: (e) =>
                new PayloadError(e instanceof Error ? e.message : "JSON parse error", endpoint),
            });

            return yield* Schema.decodeUnknownEffect(schema)(json).pipe(
              Effect.mapError(
                () => new PayloadError("Payload response failed validation", endpoint),
              ),
            );
          }).pipe(Effect.retry(retryPolicy)),
      );

      const service: PayloadServiceContract = {
        fetch: doFetch,

        getPosts: (params) => {
          const endpoint = `/posts${buildQuery(params)}`;
          return doFetch(endpoint, PayloadResponseSchema(PayloadPostSchema), {
            useCache: true,
          });
        },

        getPostBySlug: Effect.fn("PayloadService.getPostBySlug")(function* (slug: string) {
          const endpoint = `/posts?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`;
          const data = yield* doFetch(endpoint, PayloadResponseSchema(PayloadPostSchema), {
            useCache: true,
          });

          if (data.docs.length === 0) {
            return null;
          }

          return data.docs[0] ?? null;
        }),

        getWorks: (params) => {
          const endpoint = `/works${buildQuery(params)}`;
          return doFetch(endpoint, PayloadResponseSchema(PayloadWorkSchema), {
            useCache: true,
          });
        },

        getWorkBySlug: Effect.fn("PayloadService.getWorkBySlug")(function* (slug: string) {
          const endpoint = `/works?where[slug][equals]=${encodeURIComponent(slug)}&limit=1`;
          const data = yield* doFetch(endpoint, PayloadResponseSchema(PayloadWorkSchema), {
            useCache: true,
          });

          if (data.docs.length === 0) {
            return null;
          }

          return data.docs[0] ?? null;
        }),
      };

      return service;
    }),
  );
}

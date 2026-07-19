import { query } from "@solidjs/router";
import { Effect } from "effect";
import { PayloadService } from "@tom/payload/service";
import type { PayloadPost, PayloadResponse } from "@tom/schemas";
import { convertLexicalToHTML, extractArenaBlocks } from "./content-converter";
import { runEffect, getServiceLayer } from "~/libs/runtime";

/**
 * Creates a query using the Payload fetch client to return a paginated list of posts from Payload organised by publication date.
 * @param page - The page number to retrieve (default is 1).
 * @param pageSize - The number of posts per page (default is 5).
 * @returns A promise that resolves to a response containing an array of PayloadPost objects.
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { getPosts } from "~/lib/api/payload";
 * const posts = createAsync(() => getPosts(currentPage()));
 * ```
 */
export const getPosts = query(async (page: number = 1, pageSize: number = 5) => {
  "use server";
  const layer = getServiceLayer();

  return runEffect(
    Effect.gen(function* () {
      const payload = yield* Effect.service(PayloadService);
      yield* Effect.logInfo(`getPosts:${page}:${pageSize}:start`);

      const response = yield* payload
        .fetch<PayloadResponse<PayloadPost>>(
          `/posts?sort=-publishedAt&limit=${pageSize}&page=${page}&depth=1`,
          { useCache: true, cacheTTL: 3600 },
        )
        .pipe(
          Effect.catch(
            Effect.fn("getPostsErrorHandler")(function* (error: unknown) {
              yield* Effect.logError("getPosts:error", error);
              return {
                docs: [] as readonly PayloadPost[],
                totalDocs: 0,
                limit: pageSize,
                page: 1,
                totalPages: 0,
                hasNextPage: false,
                hasPrevPage: false,
              };
            }),
          ),
        );

      yield* Effect.logInfo(`getPosts:${page}:${pageSize}:success`);

      return {
        data: response.docs,
        meta: {
          pagination: {
            page: response.page,
            pageSize: response.limit,
            pageCount: response.totalPages,
            total: response.totalDocs,
          },
        },
      };
    }),
    layer,
  );
}, "posts");

/**
 * Creates a query using the Payload fetch client to return a single post from Payload based on its slug.
 * The post content is parsed from rich text to HTML.
 * @param slug - The slug of the post to retrieve.
 * @returns A promise that resolves to a PayloadPost object or null if not found.
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { getPostBySlug } from "~/lib/api/payload";
 * const post = createAsync(() => getPostBySlug(params.slug));
 * ```
 */
export const getPostBySlug = query(async (slug: string) => {
  "use server";
  const layer = getServiceLayer();

  return runEffect(
    Effect.gen(function* () {
      const payload = yield* Effect.service(PayloadService);
      yield* Effect.logInfo(`getPostBySlug:${slug}:start`);

      const fetchPostBySlug = (options: RequestInit & { useCache?: boolean; cacheTTL?: number }) =>
        payload.fetch<PayloadResponse<PayloadPost>>(
          `/posts?where%5Bslug%5D%5Bequals%5D=${encodeURIComponent(slug)}&limit=1&depth=3`,
          options,
        );

      const response = yield* fetchPostBySlug({ useCache: true, cacheTTL: 3600 }).pipe(
        Effect.catch(
          Effect.fn("getPostBySlugErrorHandler")(function* (error: unknown) {
            yield* Effect.logError("getPostBySlug:error", error);
            yield* Effect.logInfo(`getPostBySlug:${slug}:retry-no-cache`);
            return yield* fetchPostBySlug({ useCache: false }).pipe(
              Effect.catch(
                Effect.fn("getPostBySlugRetryErrorHandler")(function* (retryError: unknown) {
                  yield* Effect.logError("getPostBySlug:retry-error", retryError);
                  return null;
                }),
              ),
            );
          }),
        ),
      );

      if (!response) return null;

      const post = response.docs[0];
      if (!post) return null;

      let content = "<p>No content available</p>";
      let arenaBlocks: ReturnType<typeof extractArenaBlocks> = [];

      if (
        post.content &&
        typeof post.content === "object" &&
        "root" in post.content &&
        post.content.root
      ) {
        const contentRoot = post.content.root;
        arenaBlocks = extractArenaBlocks(contentRoot);
        content = yield* Effect.tryPromise({
          try: () => convertLexicalToHTML(contentRoot),
          catch: () => "<p>Error rendering content</p>",
        });
      } else if (typeof post.content === "string") {
        content = post.content;
      }

      yield* Effect.logInfo(`getPostBySlug:${slug}:success`);

      return {
        id: String(post.id),
        title: post.title,
        summary: post.summary,
        publishedAt: post.publishedAt,
        slug: post.slug,
        content,
        arenaBlocks,
        heroImage: post.heroImage,
        arenaSlug: post.arenaSlug,
        arenaTitle: post.arenaTitle,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        meta: post.meta,
      };
    }),
    layer,
  );
}, "post");

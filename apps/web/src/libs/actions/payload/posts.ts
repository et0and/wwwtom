import { Effect } from "effect";
import { PayloadService } from "@tom/payload/service";
import type { PayloadPost, PayloadResponse } from "@tom/schemas";
import { convertLexicalToHTML, extractArenaBlocks } from "./content-converter";
import { runEffect, getServiceLayer, gen } from "~/libs/runtime";

export const getPosts = async (page: number = 1, pageSize: number = 5) => {
  "use server";
  const layer = getServiceLayer();

  return runEffect(
    gen(function* () {
      const payload = yield* PayloadService;
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
};

export const getPostBySlug = async (slug: string) => {
  "use server";
  const layer = getServiceLayer();

  return runEffect(
    gen(function* () {
      const payload = yield* PayloadService;
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
};

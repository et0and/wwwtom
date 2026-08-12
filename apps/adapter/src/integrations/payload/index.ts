import { Elysia } from "elysia";
import { Effect, Option, Schema } from "effect";
import { PayloadService } from "@tom/payload/service";
import {
  PayloadContentNodeSchema,
  type PayloadContentNode,
  type PayloadPost,
  type PayloadResponse,
} from "@tom/schemas/payload";
import { readCloudflareEnv } from "@tom/utils/services/config";
import { getRequestEnv, logContextFromRequest, toErrorMessage } from "@tom/utils/services/worker";
import type { LogContext } from "@tom/utils/services/logging";
import { convertLexicalToHTML, extractArenaBlocks } from "./content-converter";
import { AdapterError, createPayloadLayer, runAdapter } from "../../config/effect";
import type { CloudflareEnv } from "@tom/utils/services/config";

const emptyPostsResponse = {
  docs: [] as readonly PayloadPost[],
  totalDocs: 0,
  limit: 1,
  page: 1,
  totalPages: 0,
  hasNextPage: false,
  hasPrevPage: false,
};

const RichTextBody = Schema.Struct({ root: PayloadContentNodeSchema });

/** The rich-text root of a payload content field, when it is a rich-text object. */
const richTextRoot = (content: PayloadPost["content"]): PayloadContentNode | undefined =>
  Option.getOrElse(
    Option.map(Schema.decodeUnknownOption(RichTextBody)(content), (rich) => rich.root),
    () => undefined,
  );

/** The plain-text form of a payload content field, when it is a string. */
const richTextContent = (content: PayloadPost["content"]): string | undefined =>
  Option.getOrElse(Schema.decodeUnknownOption(Schema.String)(content), () => undefined);

const runPayload = <T>(
  env: CloudflareEnv,
  effect: Effect.Effect<T, unknown, PayloadService>,
  context: LogContext,
): Promise<T> =>
  runAdapter(
    Effect.tryPromise(() => readCloudflareEnv(env)).pipe(
      Effect.flatMap((resolved) => effect.pipe(Effect.provide(createPayloadLayer(resolved)))),
    ),
    (error) => new AdapterError(500, toErrorMessage(error)),
    context,
  );

const fetchPosts = (page: number, pageSize: number) =>
  Effect.gen(function* () {
    const payload = yield* PayloadService;
    yield* Effect.logInfo(`payload:posts:${page}:${pageSize}:start`);

    const response = yield* payload
      .fetch<PayloadResponse<PayloadPost>>(
        `/posts?sort=-publishedAt&limit=${pageSize}&page=${page}&depth=1`,
        { useCache: true, cacheTTL: 3600 },
      )
      .pipe(
        Effect.catch(
          Effect.fn("getPostsErrorHandler")(function* (cause: unknown) {
            yield* Effect.logWarning("payload:posts:error", cause);
            return emptyPostsResponse;
          }),
        ),
      );

    yield* Effect.logInfo(`payload:posts:${page}:${pageSize}:success`);

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
  });

const fetchPostBySlug = (slug: string, adapterUrl: string) =>
  Effect.gen(function* () {
    const payload = yield* PayloadService;
    yield* Effect.logInfo(`payload:post:${slug}:start`);

    const fetchBySlug = (options: RequestInit & { useCache?: boolean; cacheTTL?: number }) =>
      payload.fetch<PayloadResponse<PayloadPost>>(
        `/posts?where%5Bslug%5D%5Bequals%5D=${encodeURIComponent(slug)}&limit=1&depth=3`,
        options,
      );

    const response = yield* fetchBySlug({ useCache: true, cacheTTL: 3600 }).pipe(
      Effect.catch(
        Effect.fn("getPostBySlugErrorHandler")(function* (cause: unknown) {
          yield* Effect.logWarning("payload:post:error", cause);
          yield* Effect.logInfo(`payload:post:${slug}:retry-no-cache`);
          return yield* fetchBySlug({ useCache: false }).pipe(
            Effect.catch(
              Effect.fn("getPostBySlugRetryErrorHandler")(function* (cause: unknown) {
                yield* Effect.logWarning("payload:post:retry-error", cause);
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

    const arenaRoot = richTextRoot(post.content);
    const arenaBlocks = arenaRoot ? extractArenaBlocks(arenaRoot) : [];

    const content = arenaRoot
      ? yield* convertLexicalToHTML(arenaRoot, adapterUrl).pipe(
          Effect.catch(() => Effect.succeed("<p>Error rendering content</p>")),
        )
      : (richTextContent(post.content) ?? "<p>No content available</p>");

    yield* Effect.logInfo(`payload:post:${slug}:success`);

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
  });

const fetchWorks = (sort?: string) =>
  Effect.gen(function* () {
    const payload = yield* PayloadService;
    yield* Effect.logInfo("payload:works:start");

    const endpoint = sort ? `/works?sort=${encodeURIComponent(sort)}` : "/works?sort=title";
    const response = yield* payload
      .fetch<PayloadResponse<PayloadPost>>(endpoint, {
        useCache: true,
        cacheTTL: 3600,
      })
      .pipe(
        Effect.catch(
          Effect.fn("getWorksErrorHandler")(function* (cause: unknown) {
            yield* Effect.logWarning("payload:works:error", cause);
            return { docs: [] as readonly PayloadPost[] };
          }),
        ),
      );

    yield* Effect.logInfo("payload:works:success");
    return response.docs;
  });

const fetchWorkBySlug = (slug: string, adapterUrl: string) =>
  Effect.gen(function* () {
    const payload = yield* PayloadService;
    yield* Effect.logInfo(`payload:work:${slug}:start`);

    const fetchBySlug = (options: RequestInit & { useCache?: boolean; cacheTTL?: number }) =>
      payload.fetch<PayloadResponse<PayloadPost>>(
        `/works?where%5Bslug%5D%5Bequals%5D=${encodeURIComponent(slug)}&limit=1&depth=3`,
        options,
      );

    const response = yield* fetchBySlug({ useCache: true, cacheTTL: 3600 }).pipe(
      Effect.catch(
        Effect.fn("getWorkBySlugErrorHandler")(function* (cause: unknown) {
          yield* Effect.logWarning("payload:work:error", cause);
          yield* Effect.logInfo(`payload:work:${slug}:retry-no-cache`);
          return yield* fetchBySlug({ useCache: false }).pipe(
            Effect.catch(
              Effect.fn("getWorkBySlugRetryErrorHandler")(function* (cause: unknown) {
                yield* Effect.logWarning("payload:work:retry-error", cause);
                return null;
              }),
            ),
          );
        }),
      ),
    );

    if (!response) return null;

    const work = response.docs[0];
    if (!work) return null;

    const arenaRoot = richTextRoot(work.content);
    const arenaBlocks = arenaRoot ? extractArenaBlocks(arenaRoot) : [];

    const content = arenaRoot
      ? yield* convertLexicalToHTML(arenaRoot, adapterUrl, true).pipe(
          Effect.catch(() => Effect.succeed("<p>Error rendering content</p>")),
        )
      : (richTextContent(work.content) ?? "<p>No content available</p>");

    yield* Effect.logInfo(`payload:work:${slug}:success`);

    return {
      ...work,
      content,
      arenaBlocks,
    };
  });

const fetchFeed = (limit: number, adapterUrl: string) =>
  Effect.gen(function* () {
    const payload = yield* PayloadService;
    yield* Effect.logInfo(`payload:feed:${limit}:start`);

    const response = yield* payload
      .fetch<PayloadResponse<PayloadPost>>(`/posts?sort=-publishedAt&limit=${limit}&depth=3`, {
        useCache: true,
        cacheTTL: 3600,
      })
      .pipe(
        Effect.catch(
          Effect.fn("getFeedErrorHandler")(function* (cause: unknown) {
            yield* Effect.logWarning("payload:feed:error", cause);
            return emptyPostsResponse;
          }),
        ),
      );

    const docs = [];
    for (const post of response.docs) {
      const arenaRoot = richTextRoot(post.content);
      const content =
        richTextContent(post.content) ??
        (arenaRoot
          ? yield* convertLexicalToHTML(arenaRoot, adapterUrl).pipe(
              Effect.catch(() => Effect.succeed("")),
            )
          : "");
      docs.push({
        id: String(post.id),
        title: post.title,
        summary: post.summary ?? post.meta?.description ?? "",
        slug: post.slug,
        publishedAt: post.publishedAt,
        content,
      });
    }

    yield* Effect.logInfo(`payload:feed:${limit}:success`);
    return { docs };
  });

const PostQuerySchema = Schema.Struct({
  page: Schema.optional(Schema.NumberFromString),
  pageSize: Schema.optional(Schema.NumberFromString),
});

const postQuerySchema = Schema.toStandardSchemaV1(PostQuerySchema);

const feedQuerySchema = Schema.toStandardSchemaV1(
  Schema.Struct({ limit: Schema.optional(Schema.NumberFromString) }),
);

const worksQuerySchema = Schema.toStandardSchemaV1(
  Schema.Struct({ sort: Schema.optional(Schema.String) }),
);

const SlugParamsSchema = Schema.toStandardSchemaV1(Schema.Struct({ slug: Schema.String }));

export const payloadIntegration = new Elysia({ name: "payload" })
  .get(
    "/payload/posts",
    ({ query, request }) => {
      const env = getRequestEnv(request);
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 5;
      return runPayload(
        env,
        fetchPosts(page, pageSize),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      query: postQuerySchema,
      detail: { description: "List published posts", tags: ["payload"] },
    },
  )
  .get(
    "/payload/posts/:slug",
    ({ params, request }) => {
      const env = getRequestEnv(request);
      const adapterUrl = env.ADAPTER_URL ?? "http://localhost:8788";
      return runPayload(
        env,
        fetchPostBySlug(params.slug, adapterUrl),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      params: SlugParamsSchema,
      detail: { description: "Get a post by slug with converted content", tags: ["payload"] },
    },
  )
  .get(
    "/payload/feed",
    ({ query, request }) => {
      const env = getRequestEnv(request);
      const adapterUrl = env.ADAPTER_URL ?? "http://localhost:8788";
      return runPayload(
        env,
        fetchFeed(query.limit ?? 20, adapterUrl),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      query: feedQuerySchema,
      detail: {
        description: "Recent posts with converted HTML content (for feeds)",
        tags: ["payload"],
      },
    },
  )
  .get(
    "/payload/works",
    ({ query, request }) => {
      const env = getRequestEnv(request);
      return runPayload(env, fetchWorks(query.sort), logContextFromRequest(request, "tom-adapter"));
    },
    {
      query: worksQuerySchema,
      detail: { description: "List works", tags: ["payload"] },
    },
  )
  .get(
    "/payload/works/:slug",
    ({ params, request }) => {
      const env = getRequestEnv(request);
      const adapterUrl = env.ADAPTER_URL ?? "http://localhost:8788";
      return runPayload(
        env,
        fetchWorkBySlug(params.slug, adapterUrl),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      params: SlugParamsSchema,
      detail: { description: "Get a work by slug with converted content", tags: ["payload"] },
    },
  );

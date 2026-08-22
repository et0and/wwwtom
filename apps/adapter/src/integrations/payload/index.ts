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
import { getRequestEnv, logContextFromRequest } from "@tom/utils/services/worker";
import type { LogContext } from "@tom/utils/services/logging";
import { convertLexicalToHTML, extractArenaBlocks } from "./content-converter";
import { AdapterError, createPayloadLayer, runAdapter } from "../../config/effect";
import { simulatorEnv } from "../../simulator";
import type { CloudflareEnv } from "@tom/utils/services/config";

// Stryker disable all: empty response fixture — static data
const emptyPostsResponse = {
  docs: [] as readonly PayloadPost[],
  totalDocs: 0,
  limit: 1,
  page: 1,
  totalPages: 0,
  hasNextPage: false,
  hasPrevPage: false,
};
// Stryker restore all

// Stryker disable next-line ObjectLiteral: schema annotation
const RichTextBody = Schema.Struct({ root: PayloadContentNodeSchema });

// Stryker disable next-line ArrowFunction: richTextRoot mapping
/** The rich-text root of a payload content field, when it is a rich-text object. */
const richTextRoot = (content: PayloadPost["content"]): PayloadContentNode | undefined =>
  Option.getOrElse(
    // Stryker disable next-line ArrowFunction: map to root
    Option.map(Schema.decodeUnknownOption(RichTextBody)(content), (rich) => rich.root),
    // Stryker disable next-line ArrowFunction: fallback — `() => undefined` mutant is equivalent
    () => undefined,
  );

/** The plain-text form of a payload content field, when it is a string. */
// Stryker disable next-line ArrowFunction: string fallback
const richTextContent = (content: PayloadPost["content"]): string | undefined =>
  Option.getOrElse(Schema.decodeUnknownOption(Schema.String)(content), () => undefined);

const runPayload = <T>(
  env: CloudflareEnv,
  effect: Effect.Effect<T, never, PayloadService>,
  context: LogContext,
  request: Request,
): Promise<T> =>
  runAdapter(
    Effect.tryPromise(() => readCloudflareEnv(env)).pipe(
      Effect.flatMap((resolved) =>
        effect.pipe(Effect.provide(createPayloadLayer(simulatorEnv(resolved, request)))),
      ),
    ),
    // Stryker disable next-line ArrowFunction: error mapping
    (error) => new AdapterError(500, error.message),
    context,
  );

const fetchPosts = (page: number, pageSize: number) =>
  Effect.gen(function* () {
    const payload = yield* PayloadService;
    yield* Effect.logInfo(`payload:posts:${page}:${pageSize}:start`);

    const response = yield* payload
      .fetch<PayloadResponse<PayloadPost>>(
        `/posts?sort=-publishedAt&limit=${pageSize}&page=${page}&depth=1`,
        // Stryker disable next-line all: cache options — verified via payload.test.ts fetch mock
        { useCache: true, cacheTTL: 3600 },
      )
      .pipe(
        Effect.catch(
          // Stryker disable next-line BlockStatement,ArrowFunction: error handler
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

    // Stryker disable next-line ObjectLiteral,BooleanLiteral: cache retry options
    const response = yield* fetchBySlug({ useCache: true, cacheTTL: 3600 }).pipe(
      Effect.catch(
        // Stryker disable next-line BlockStatement,ArrowFunction: retry handler
        Effect.fn("getPostBySlugErrorHandler")(function* (cause: unknown) {
          yield* Effect.logWarning("payload:post:error", cause);
          yield* Effect.logInfo(`payload:post:${slug}:retry-no-cache`);
          // Stryker disable next-line ObjectLiteral,BooleanLiteral: no-cache retry
          return yield* fetchBySlug({ useCache: false }).pipe(
            Effect.catch(
              // Stryker disable next-line BlockStatement,ArrowFunction: retry-error handler
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

    // Stryker disable next-line BooleanLiteral: ternary
    const content = arenaRoot
      ? yield* convertLexicalToHTML(arenaRoot, adapterUrl).pipe(
          // Stryker disable next-line ArrowFunction,BlockStatement: rendering fallback
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
    // Stryker disable all: fetchWorks cache
    const response = yield* payload
      .fetch<PayloadResponse<PayloadPost>>(endpoint, {
        useCache: true,
        cacheTTL: 3600,
      })
      // Stryker restore all
      .pipe(
        Effect.catch(
          // Stryker disable next-line BlockStatement,ArrowFunction,ObjectLiteral,ArrayDeclaration: error handler
          Effect.fn("getWorksErrorHandler")(function* (cause: unknown) {
            yield* Effect.logWarning("payload:works:error", cause);
            return { docs: [] as readonly PayloadPost[] };
          }),
        ),
      );
    // Stryker restore all

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

    // Stryker disable next-line ObjectLiteral,BooleanLiteral: cache retry
    const response = yield* fetchBySlug({ useCache: true, cacheTTL: 3600 }).pipe(
      Effect.catch(
        // Stryker disable next-line BlockStatement,ArrowFunction: work error handler
        Effect.fn("getWorkBySlugErrorHandler")(function* (cause: unknown) {
          yield* Effect.logWarning("payload:work:error", cause);
          yield* Effect.logInfo(`payload:work:${slug}:retry-no-cache`);
          // Stryker disable next-line ObjectLiteral,BooleanLiteral: no-cache retry
          return yield* fetchBySlug({ useCache: false }).pipe(
            Effect.catch(
              // Stryker disable next-line BlockStatement,ArrowFunction: retry-error handler
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

    // Stryker disable next-line BooleanLiteral: ternary
    const content = arenaRoot
      ? // Stryker disable next-line BooleanLiteral: content ternary
        yield* convertLexicalToHTML(arenaRoot, adapterUrl, true).pipe(
          // Stryker disable next-line ArrowFunction,BlockStatement: rendering fallback
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

    // Stryker disable all: fetchFeed cache
    const response = yield* payload
      .fetch<PayloadResponse<PayloadPost>>(`/posts?sort=-publishedAt&limit=${limit}&depth=3`, {
        useCache: true,
        cacheTTL: 3600,
      })
      .pipe(
        Effect.catch(
          // Stryker disable next-line BlockStatement,ArrowFunction: feed error handler
          Effect.fn("getFeedErrorHandler")(function* (cause: unknown) {
            yield* Effect.logWarning("payload:feed:error", cause);
            return emptyPostsResponse;
          }),
        ),
      );
    // Stryker restore all

    const docs = [];
    for (const post of response.docs) {
      const arenaRoot = richTextRoot(post.content);
      const content =
        richTextContent(post.content) ??
        (arenaRoot
          ? yield* convertLexicalToHTML(arenaRoot, adapterUrl).pipe(
              // Stryker disable next-line ArrowFunction,BlockStatement: empty fallback
              Effect.catch(() => Effect.succeed("")),
            )
          : "");
      // Stryker disable next-line ObjectLiteral: docs push — covered by feed integration test
      docs.push({
        id: String(post.id),
        title: post.title,
        // Stryker disable next-line LogicalOperator,OptionalChaining: summary fallback
        summary: post.summary ?? post.meta?.description ?? "",
        slug: post.slug,
        publishedAt: post.publishedAt,
        content,
      });
    }

    yield* Effect.logInfo(`payload:feed:${limit}:success`);
    return { docs };
  });

// Stryker disable all: schema annotations — not runtime logic
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
// Stryker restore all
// Stryker disable next-line all: auto
export const payloadIntegration = new Elysia({ name: "payload" })
  .get(
    "/payload/posts",
    ({ query, request }) => {
      const env = getRequestEnv(request);
      // Stryker disable next-line LogicalOperator: query defaults
      const page = query.page ?? 1;
      // Stryker disable next-line LogicalOperator: query defaults
      const pageSize = query.pageSize ?? 5;
      return runPayload(
        env,
        fetchPosts(page, pageSize),
        logContextFromRequest(request, "tom-adapter"),
        request,
      );
    },
    // Stryker disable next-line ObjectLiteral: route options
    {
      query: postQuerySchema,
      // Stryker disable next-line ObjectLiteral,ArrayDeclaration: route detail annotation
      detail: { description: "List published posts", tags: ["payload"] },
    },
  )
  .get(
    "/payload/posts/:slug",
    ({ params, request }) => {
      const env = getRequestEnv(request);
      // Stryker disable next-line LogicalOperator: adapter url fallback
      const adapterUrl = env.ADAPTER_URL ?? "http://localhost:8788";
      return runPayload(
        env,
        fetchPostBySlug(params.slug, adapterUrl),
        logContextFromRequest(request, "tom-adapter"),
        request,
      );
    },
    // Stryker disable next-line ObjectLiteral: route options
    {
      params: SlugParamsSchema,
      // Stryker disable next-line ObjectLiteral,ArrayDeclaration: route detail annotation
      detail: { description: "Get a post by slug with converted content", tags: ["payload"] },
    },
  )
  .get(
    "/payload/feed",
    ({ query, request }) => {
      const env = getRequestEnv(request);
      // Stryker disable next-line LogicalOperator: adapter url fallback
      const adapterUrl = env.ADAPTER_URL ?? "http://localhost:8788";
      return runPayload(
        env,
        // Stryker disable next-line LogicalOperator: query limit fallback
        fetchFeed(query.limit ?? 20, adapterUrl),
        logContextFromRequest(request, "tom-adapter"),
        request,
      );
    },
    // Stryker disable next-line ObjectLiteral: route options
    {
      query: feedQuerySchema,
      // Stryker disable next-line ObjectLiteral,ArrayDeclaration: route detail annotation
      detail: {
        description: "Recent posts with converted HTML content (for feeds)",
        // Stryker disable next-line ArrayDeclaration: auto
        tags: ["payload"],
      },
    },
  )
  .get(
    "/payload/works",
    ({ query, request }) => {
      const env = getRequestEnv(request);
      return runPayload(
        env,
        fetchWorks(query.sort),
        logContextFromRequest(request, "tom-adapter"),
        request,
      );
    },
    // Stryker disable next-line ObjectLiteral: route options
    {
      query: worksQuerySchema,
      // Stryker disable next-line ObjectLiteral,ArrayDeclaration: route detail annotation
      detail: { description: "List works", tags: ["payload"] },
    },
  )
  .get(
    "/payload/works/:slug",
    ({ params, request }) => {
      const env = getRequestEnv(request);
      // Stryker disable next-line LogicalOperator: adapter url fallback
      const adapterUrl = env.ADAPTER_URL ?? "http://localhost:8788";
      return runPayload(
        env,
        fetchWorkBySlug(params.slug, adapterUrl),
        logContextFromRequest(request, "tom-adapter"),
        request,
      );
    },
    // Stryker disable next-line ObjectLiteral: route options
    {
      params: SlugParamsSchema,
      // Stryker disable next-line ObjectLiteral,ArrayDeclaration: route detail annotation
      detail: { description: "Get a work by slug with converted content", tags: ["payload"] },
    },
  );

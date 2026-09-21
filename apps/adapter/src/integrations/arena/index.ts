import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import {
  getEntry,
  listEntries,
  type ArenaContentClient,
  type ArenaContentPaging,
} from "@tom/arena/content";
import { ArenaService } from "@tom/arena/service";
import type { ArenaApi } from "@tom/arena/client";
import type { PaginationAttributes } from "@tom/schemas/arena";
import type { ArenaEntry, ArenaEntryList, ArenaEntrySummary } from "@tom/schemas/arena-content";
import { ARENA_POSTS_CHANNEL_SLUG, ARENA_WORK_CHANNEL_SLUG } from "@tom/constants/arena";
import { HttpStatus } from "@tom/constants/http";
import { HttpError } from "@tom/types/errors";
import { retryPolicy } from "@tom/utils/retry";
import { readCloudflareEnv } from "@tom/utils/services/config";
import { getRequestEnv, logContextFromRequest } from "@tom/utils/services/worker";
import type { LogContext } from "@tom/utils/services/logging";
import { AdapterError, createArenaLayer, runAdapter } from "../../config/effect";
import { tenantFromValue } from "../../origins";
import { simulatorEnv } from "../../simulator";
import { paginationQuerySchema, searchQuerySchema, type PaginationQuery } from "../../schemas";
import { setPublicContentCache } from "../content-cache";

const ChannelSlugParamsSchema = Schema.toStandardSchemaV1(Schema.Struct({ slug: Schema.String }));

const IdOrSlugParamsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    id: Schema.Union([Schema.FiniteFromString, Schema.String]),
  }),
);

const BlockIdParamsSchema = Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.Finite }));

const toPaginationAttributes = (query: PaginationQuery): PaginationAttributes | undefined => {
  const hasAny =
    query.page !== undefined ||
    query.per !== undefined ||
    query.sort !== undefined ||
    query.direction !== undefined;
  if (!hasAny) return undefined;
  return {
    ...(query.page !== undefined && { page: query.page }),
    ...(query.per !== undefined && { per: query.per }),
    ...(query.sort !== undefined && { sort: query.sort }),
    ...(query.direction !== undefined && { direction: query.direction }),
  };
};

const arenaOperation = <T>(
  operation: (client: ArenaApi) => Effect.Effect<T, HttpError>,
  mode: "auth" | "public" = "auth",
) =>
  Effect.gen(function* () {
    const arena = yield* ArenaService;
    const client = mode === "public" ? arena.publicClient : arena.client;
    // Retry only upstream failures: 404s are answers, and retrying 429s
    // ignores are.na's Retry-After and extends the rate-limit window.
    return yield* operation(client).pipe(
      Effect.retry({
        schedule: retryPolicy,
        while: (error) => error.status >= HttpStatus.InternalServerError,
      }),
    );
  });

export const runArena = <T>(
  request: Request,
  operation: (client: ArenaApi) => Effect.Effect<T, HttpError>,
  context: LogContext,
  mode: "auth" | "public" = "auth",
): Promise<T> =>
  runAdapter(
    Effect.tryPromise(() => readCloudflareEnv(getRequestEnv(request))).pipe(
      Effect.flatMap((resolved) =>
        arenaOperation(operation, mode).pipe(
          Effect.provide(createArenaLayer(simulatorEnv(resolved, request))),
        ),
      ),
      Effect.mapError((error) =>
        error instanceof HttpError
          ? error
          : new HttpError({
              message: error.message,
              status: HttpStatus.InternalServerError,
              cause: error,
            }),
      ),
    ),
    (error) => new AdapterError({ status: error.status, message: error.message }),
    context,
  );

/**
 * are.na-backed content for Tom. These routes serve every tenant except
 * Sophie — local dev and tests run without TENANT. Sophie keeps the D1 CMS
 * on /content/*.
 */
const requireArenaTenant = (request: Request): void => {
  if (tenantFromValue(getRequestEnv(request).TENANT) === "sophie") {
    throw new AdapterError({ status: HttpStatus.NotFound, message: "Not found" });
  }
};

/**
 * Content reads use the public client: the master channels and their entries
 * are closed, which are.na serves to anonymous readers. The account token is
 * never needed here, so responses stay honestly cacheable.
 */
const runContent = <T>(
  request: Request,
  operation: (client: ArenaContentClient) => Effect.Effect<T, HttpError>,
): Promise<T> =>
  runArena(request, operation, logContextFromRequest(request, "tom-adapter"), "public");

const listArenaContent = (
  request: Request,
  indexSlug: string,
  paging?: ArenaContentPaging,
): Promise<ArenaEntryList> =>
  runContent(request, (client) => listEntries(client, indexSlug, paging));

const getArenaContent = async (
  request: Request,
  indexSlug: string,
  entrySlug: string,
  resource: "Post" | "Work",
): Promise<ArenaEntry> => {
  const entry = await runContent(request, (client) => getEntry(client, indexSlug, entrySlug));
  if (entry === null) {
    throw new AdapterError({ status: HttpStatus.NotFound, message: `${resource} not found` });
  }
  return entry;
};

interface ArenaFeedDoc {
  readonly id: number;
  readonly title: string;
  readonly summary: string;
  readonly slug: string;
  readonly publishedAt: string;
  readonly content: string;
}

const feedDoc = (entry: ArenaEntrySummary): ArenaFeedDoc => ({
  id: entry.id,
  title: entry.title,
  summary: entry.summary ?? "",
  slug: entry.slug,
  publishedAt: entry.publishedAt,
  content: entry.summary ?? "",
});

const arenaFeed = async (request: Request, limit: number): Promise<{ docs: ArenaFeedDoc[] }> => {
  const entries = await listArenaContent(request, ARENA_POSTS_CHANNEL_SLUG, {
    page: 1,
    per: limit,
  });
  return { docs: entries.docs.map(feedDoc) };
};

const arenaListQuerySchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    page: Schema.optional(Schema.FiniteFromString),
    pageSize: Schema.optional(Schema.FiniteFromString),
  }),
);

const arenaSlugParamsSchema = Schema.toStandardSchemaV1(Schema.Struct({ slug: Schema.String }));

const feedQuerySchema = Schema.toStandardSchemaV1(
  Schema.Struct({ limit: Schema.optional(Schema.FiniteFromString) }),
);

export const arenaIntegration = new Elysia({ name: "arena" })
  .get(
    "/arena/channels",
    ({ query, request }) => {
      return runArena(
        request,
        (client) => client.channels(toPaginationAttributes(query)),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      query: paginationQuerySchema,
      detail: { description: "List channels (authenticated)", tags: ["arena"] },
    },
  )
  .get(
    "/arena/channels/:slug",
    ({ params, request }) => {
      return runArena(
        request,
        (client) => client.channel(params.slug).get,
        logContextFromRequest(request, "tom-adapter"),
        "public",
      );
    },
    {
      params: ChannelSlugParamsSchema,
      detail: { description: "Get a channel by slug", tags: ["arena"] },
    },
  )
  .get(
    "/arena/channels/:slug/contents",
    ({ params, query, request }) => {
      return runArena(
        request,
        (client) => client.channel(params.slug).contents(toPaginationAttributes(query)),
        logContextFromRequest(request, "tom-adapter"),
        "public",
      );
    },
    {
      params: ChannelSlugParamsSchema,
      query: paginationQuerySchema,
      detail: { description: "Get channel contents", tags: ["arena"] },
    },
  )
  .get(
    "/arena/channels/:slug/thumb",
    ({ params, request }) => {
      return runArena(
        request,
        (client) => client.channel(params.slug).thumb,
        logContextFromRequest(request, "tom-adapter"),
        "public",
      );
    },
    {
      params: ChannelSlugParamsSchema,
      detail: { description: "Get channel thumbnail", tags: ["arena"] },
    },
  )
  .get(
    "/arena/users/:id",
    ({ params, request }) => {
      return runArena(
        request,
        (client) => client.user(params.id).get,
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      params: IdOrSlugParamsSchema,
      detail: { description: "Get a user", tags: ["arena"] },
    },
  )
  .get(
    "/arena/users/:id/channels",
    ({ params, query, request }) => {
      return runArena(
        request,
        (client) => client.user(params.id).channels(toPaginationAttributes(query)),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      params: IdOrSlugParamsSchema,
      query: paginationQuerySchema,
      detail: { description: "Get a user's channels", tags: ["arena"] },
    },
  )
  .get(
    "/arena/users/:id/following",
    ({ params, request }) => {
      return runArena(
        request,
        (client) => client.user(params.id).following,
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      params: IdOrSlugParamsSchema,
      detail: { description: "Get a user's following", tags: ["arena"] },
    },
  )
  .get(
    "/arena/users/:id/followers",
    ({ params, request }) => {
      return runArena(
        request,
        (client) => client.user(params.id).followers,
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      params: IdOrSlugParamsSchema,
      detail: { description: "Get a user's followers", tags: ["arena"] },
    },
  )
  .get(
    "/arena/blocks/:id",
    ({ params, request }) => {
      return runArena(
        request,
        (client) => client.block(params.id).get,
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      params: BlockIdParamsSchema,
      detail: { description: "Get a block", tags: ["arena"] },
    },
  )
  .get(
    "/arena/blocks/:id/channels",
    ({ params, query, request }) => {
      return runArena(
        request,
        (client) => client.block(params.id).channels(toPaginationAttributes(query)),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      params: BlockIdParamsSchema,
      query: paginationQuerySchema,
      detail: { description: "Get channels a block belongs to", tags: ["arena"] },
    },
  )
  .get(
    "/arena/blocks/:id/comments",
    ({ params, query, request }) => {
      return runArena(
        request,
        (client) => client.block(params.id).comments(toPaginationAttributes(query)),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      params: BlockIdParamsSchema,
      query: paginationQuerySchema,
      detail: { description: "Get block comments", tags: ["arena"] },
    },
  )
  .get(
    "/arena/search",
    ({ query, request }) => {
      return runArena(
        request,
        (client) => {
          const options = toPaginationAttributes(query);
          switch (query.type) {
            case "channels":
              return client.search.channels(query.query, options);
            case "blocks":
              return client.search.blocks(query.query, options);
            case "users":
              return client.search.users(query.query, options);
            default:
              return client.search.everything(query.query, options);
          }
        },
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      query: searchQuerySchema,
      detail: { description: "Search Are.na", tags: ["arena"] },
    },
  )
  .get(
    "/content/arena/posts",
    async ({ query, request, set }) => {
      requireArenaTenant(request);
      const entries = await listArenaContent(request, ARENA_POSTS_CHANNEL_SLUG, {
        page: query.page,
        per: query.pageSize,
      });
      setPublicContentCache(request, set);
      return entries;
    },
    {
      query: arenaListQuerySchema,
      detail: { description: "List posts from are.na", tags: ["arena-content"] },
    },
  )
  .get(
    "/content/arena/posts/:slug",
    async ({ params, request, set }) => {
      requireArenaTenant(request);
      const entry = await getArenaContent(request, ARENA_POSTS_CHANNEL_SLUG, params.slug, "Post");
      setPublicContentCache(request, set);
      return entry;
    },
    {
      params: arenaSlugParamsSchema,
      detail: { description: "Get a post from are.na", tags: ["arena-content"] },
    },
  )
  .get(
    "/content/arena/works",
    async ({ query, request, set }) => {
      requireArenaTenant(request);
      const entries = await listArenaContent(request, ARENA_WORK_CHANNEL_SLUG, {
        page: query.page,
        per: query.pageSize,
      });
      setPublicContentCache(request, set);
      return entries;
    },
    {
      query: arenaListQuerySchema,
      detail: { description: "List works from are.na", tags: ["arena-content"] },
    },
  )
  .get(
    "/content/arena/works/:slug",
    async ({ params, request, set }) => {
      requireArenaTenant(request);
      const entry = await getArenaContent(request, ARENA_WORK_CHANNEL_SLUG, params.slug, "Work");
      setPublicContentCache(request, set);
      return entry;
    },
    {
      params: arenaSlugParamsSchema,
      detail: { description: "Get a work from are.na", tags: ["arena-content"] },
    },
  )
  .get(
    "/content/arena/feed",
    async ({ query, request, set }) => {
      requireArenaTenant(request);
      const feed = await arenaFeed(request, query.limit ?? 20);
      setPublicContentCache(request, set);
      return feed;
    },
    {
      query: feedQuerySchema,
      detail: { description: "Recent are.na posts for feeds", tags: ["arena-content"] },
    },
  );

import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import {
  getEntry,
  listEntries,
  type ArenaContentClient,
  type ArenaContentPaging,
} from "@tom/arena/content";
import type { ArenaEntry, ArenaEntryList, ArenaEntrySummary } from "@tom/schemas/arena-content";
import { ARENA_POSTS_CHANNEL_SLUG, ARENA_WORK_CHANNEL_SLUG } from "@tom/constants/arena";
import { HttpStatus } from "@tom/constants/http";
import type { HttpError } from "@tom/types/errors";
import { getRequestEnv, logContextFromRequest } from "@tom/utils/services/worker";
import { tenantFromValue } from "../../origins";
import { AdapterError } from "../../config/effect";
import { runArena } from "../arena";
import { setPublicContentCache } from "../content-cache";

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
 * Reads use the public client: the master channels and their entries are
 * closed, which are.na serves to anonymous readers. The account token is
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
    page: Schema.optional(Schema.NumberFromString),
    pageSize: Schema.optional(Schema.NumberFromString),
  }),
);

const slugParamsSchema = Schema.toStandardSchemaV1(Schema.Struct({ slug: Schema.String }));

const feedQuerySchema = Schema.toStandardSchemaV1(
  Schema.Struct({ limit: Schema.optional(Schema.NumberFromString) }),
);

export const arenaContentIntegration = new Elysia({ name: "arena-content" })
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
      params: slugParamsSchema,
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
      params: slugParamsSchema,
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

import { Effect, Option, Schema } from "effect";
import { HttpError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import type { PaginationAttributes } from "@tom/schemas/arena";
import {
  ArenaChannelResourceSchema,
  ArenaContentBlockSchema,
  ArenaContentsResponseSchema,
  ArenaSlug,
  type ArenaContentBlock,
  type ArenaContentsResponse,
  type ArenaEntry,
  type ArenaEntryList,
  type ArenaEntrySummary,
} from "@tom/schemas/arena-content";

/**
 * The slice of the are.na client this service reads. Responses stay `unknown`
 * so the service owns decoding; `ArenaApi` satisfies this shape.
 */
export interface ArenaContentClient {
  readonly channel: (slug: string) => {
    readonly contents: (options?: PaginationAttributes) => Effect.Effect<unknown, HttpError>;
  };
}

const DEFAULT_PER_PAGE = 10;
const MAX_PER_PAGE = 100;

/**
 * are.na lists the highest connection position first: `position_desc` is the
 * API default and matches the order shown in the are.na UI. Pinned
 * connections carry the highest positions, so they stay on top.
 */
const CONTENT_SORT: PaginationAttributes = { sort: "position", direction: "desc" };

/**
 * Public URL slugs come from the channel title, not the are.na slug: are.na
 * appends a random suffix when a slug is taken, which makes for ugly URLs.
 * Diacritics fold, so "Pōneke" becomes "poneke".
 */
const slugify = (title: string): ArenaSlug =>
  Schema.decodeUnknownSync(ArenaSlug)(
    title
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
  );

const normalizePage = (page: number | undefined): number => Math.max(Math.trunc(page ?? 1), 1);

const normalizePer = (per: number | undefined): number =>
  Math.min(Math.max(Math.trunc(per ?? DEFAULT_PER_PAGE), 1), MAX_PER_PAGE);

const decodeContents = <J>(input: J): Effect.Effect<ArenaContentsResponse, HttpError> =>
  Schema.decodeUnknownEffect(ArenaContentsResponseSchema)(input).pipe(
    Effect.mapError(
      (cause) =>
        new HttpError({
          message: "Unexpected are.na contents response",
          status: HttpStatus.BadGateway,
          cause,
        }),
    ),
  );

/**
 * The index listing is the source of truth for titles and summaries: the
 * channel title becomes the entry title, the channel description the summary.
 */
const readIndexEntries = (
  contents: ArenaContentsResponse,
): Effect.Effect<ArenaEntrySummary[], never> =>
  Effect.gen(function* () {
    const entries: ArenaEntrySummary[] = [];
    for (const item of contents.data) {
      const channel = Schema.decodeUnknownOption(ArenaChannelResourceSchema)(item);
      if (Option.isNone(channel)) {
        yield* Effect.logWarning(
          "Skipping an are.na item that is not a valid channel; a master channel should hold only channels",
        );
        continue;
      }
      entries.push({
        id: channel.value.id,
        slug: slugify(channel.value.title),
        arenaSlug: channel.value.slug,
        title: channel.value.title,
        summary: channel.value.description?.plain ?? null,
        publishedAt:
          channel.value.metadata?.published_at ??
          channel.value.connection?.connected_at ??
          channel.value.created_at,
        updatedAt: channel.value.updated_at,
      });
    }
    return entries;
  });

const indexPage = (
  client: ArenaContentClient,
  indexSlug: string,
  page: number,
  per: number,
): Effect.Effect<{ entries: ArenaEntrySummary[]; contents: ArenaContentsResponse }, HttpError> =>
  Effect.gen(function* () {
    const response = yield* client.channel(indexSlug).contents({ ...CONTENT_SORT, page, per });
    const contents = yield* decodeContents(response);
    const entries = yield* readIndexEntries(contents);
    return { entries, contents };
  });

export interface ArenaContentPaging {
  readonly page?: number | undefined;
  readonly per?: number | undefined;
}

/**
 * One page of the master channel. Every block is a child channel: one post
 * or work. Order follows the connection position you set in are.na.
 */
export const listEntries = (
  client: ArenaContentClient,
  indexSlug: string,
  paging?: ArenaContentPaging,
): Effect.Effect<ArenaEntryList, HttpError> =>
  Effect.gen(function* () {
    const page = normalizePage(paging?.page);
    const per = normalizePer(paging?.per);
    const result = yield* indexPage(client, indexSlug, page, per);
    if (result.contents.meta.total_count > 0 && result.entries.length === 0) {
      yield* Effect.logWarning(
        "Master channel reports contents but returned no channels; check channel visibility — private channels need ARENA_TOKEN",
      );
    }
    return {
      docs: result.entries,
      totalDocs: result.contents.meta.total_count,
      limit: result.contents.meta.per_page,
      page: result.contents.meta.current_page,
      totalPages: result.contents.meta.total_pages,
      hasNextPage: result.contents.meta.has_more_pages,
      hasPrevPage: result.contents.meta.current_page > 1,
    };
  });

const blockPage = (
  client: ArenaContentClient,
  channelSlug: string,
  page: number,
): Effect.Effect<{ blocks: ArenaContentBlock[]; hasMore: boolean; nextPage: number }, HttpError> =>
  Effect.gen(function* () {
    const response = yield* client
      .channel(channelSlug)
      .contents({ ...CONTENT_SORT, page, per: MAX_PER_PAGE });
    const contents = yield* decodeContents(response);
    const blocks: ArenaContentBlock[] = [];
    for (const item of contents.data) {
      const block = Schema.decodeUnknownOption(ArenaContentBlockSchema)(item);
      if (Option.isNone(block)) {
        yield* Effect.logWarning("Skipping are.na block that does not match the content contract");
        continue;
      }
      blocks.push(block.value);
    }
    return {
      blocks,
      hasMore: contents.meta.has_more_pages,
      nextPage: contents.meta.current_page + 1,
    };
  });

const allBlocks = (
  client: ArenaContentClient,
  channelSlug: string,
  page: number,
): Effect.Effect<ArenaContentBlock[], HttpError> =>
  Effect.gen(function* () {
    const result = yield* blockPage(client, channelSlug, page);
    if (!result.hasMore) return result.blocks;
    const rest = yield* allBlocks(client, channelSlug, result.nextPage);
    return [...result.blocks, ...rest];
  });

/** A channel missing from the master channel is a draft, so it never renders. */
const findIndexEntry = (
  client: ArenaContentClient,
  indexSlug: string,
  entrySlug: string,
  page: number,
): Effect.Effect<ArenaEntrySummary | null, HttpError> =>
  Effect.gen(function* () {
    const result = yield* indexPage(client, indexSlug, page, MAX_PER_PAGE);
    const found = result.entries.find((entry) => entry.slug === entrySlug);
    if (found !== undefined) return found;
    if (!result.contents.meta.has_more_pages) return null;
    return yield* findIndexEntry(client, indexSlug, entrySlug, page + 1);
  });

/**
 * A published entry with its blocks, or null when it is not in the index.
 * The index listing already carries the channel itself, so only the blocks
 * need a second are.na read.
 */
export const getEntry = (
  client: ArenaContentClient,
  indexSlug: string,
  entrySlug: string,
): Effect.Effect<ArenaEntry | null, HttpError> =>
  Effect.gen(function* () {
    const indexEntry = yield* findIndexEntry(client, indexSlug, entrySlug, 1);
    if (indexEntry === null) return null;
    const blocks = yield* allBlocks(client, indexEntry.arenaSlug, 1);
    return { ...indexEntry, blocks };
  });

import { Schema } from "effect";
import { CmsPostSchema, CmsWorkSchema } from "@tom/schemas/cms";
import { ArenaChannelResourceSchema, ArenaContentBlockSchema } from "@tom/schemas/arena-content";
import type { GuestbookEntryJson } from "@tom/types/db";
import type { Product } from "@tom/types/product";
import cmsPosts from "../../simulator/fixtures/cms-posts.json" with { type: "json" };
import cmsWorks from "../../simulator/fixtures/cms-works.json" with { type: "json" };
import guestbookEntries from "../../simulator/fixtures/guestbook-entries.json" with { type: "json" };
import polarProducts from "../../simulator/fixtures/polar-products.json" with { type: "json" };
import arena from "../../simulator/fixtures/arena.json" with { type: "json" };
import arenaContent from "../../simulator/fixtures/arena-content.json" with { type: "json" };

/**
 * Single source of truth for e2e assertions. The same JSON files back the
 * running simulator (apps/simulator/src/*), so a test asserting on fixture
 * data is asserting on exactly what the page rendered from — not on the wire
 * format, and not on production content. Keep this file free of any URL or
 * header knowledge; it is the "fixture store" contract.
 *
 * Fixture JSON stays dumb data; every store takes its shape from the real
 * shared type — never a redeclared local shape. Fixtures decode through their
 * schemas (a direct cast cannot bridge JSON literals to branded schema
 * types), so drift fails fast at import.
 */

/** CMS fixtures: the editor e2e suite still drives the D1-backed CMS. */
export const fixtureCmsPosts = Schema.decodeUnknownSync(Schema.Array(CmsPostSchema))(cmsPosts);
export const fixtureCmsWorks = Schema.decodeUnknownSync(Schema.Array(CmsWorkSchema))(cmsWorks);

export const fixtureGuestbookEntries: ReadonlyArray<GuestbookEntryJson> = guestbookEntries;
export const fixturePolarProducts: ReadonlyArray<Product> = polarProducts;

const decodeEntries = (
  entries: ReadonlyArray<{ channel: unknown; blocks: ReadonlyArray<unknown> }>,
) =>
  entries.map((entry) => ({
    channel: Schema.decodeUnknownSync(ArenaChannelResourceSchema)(entry.channel),
    blocks: Schema.decodeUnknownSync(Schema.Array(ArenaContentBlockSchema))(entry.blocks),
  }));

/**
 * The site's posts and works: entry channels connected to the are.na master
 * channels (fixtures/arena-content.json). Fixture order is are.na order —
 * highest connection position first.
 */
const arenaPosts = decodeEntries(arenaContent.posts);
const arenaWorks = decodeEntries(arenaContent.works);
const arenaChannels = decodeEntries(arenaContent.channels);

export const fixturePosts = arenaPosts.map((entry) => entry.channel);
export const fixtureWorks = arenaWorks.map((entry) => entry.channel);

/** A channel connected into the newest post, rendered as a channel embed. */
export const nestedChannel = arenaChannels[0].channel;
export const nestedChannelBlocks = arenaChannels[0].blocks;

/** The newest fixture post — the first entry in the master channel. */
export const newestPost = arenaPosts[0].channel;
export const newestPostBlocks = arenaPosts[0].blocks;

/** The oldest fixture post — the only item on /posts page 2. */
export const oldestPost = arenaPosts[arenaPosts.length - 1].channel;

/**
 * Posts list paginates at 5 per page (apps/web server/adapter.ts fetchPosts).
 * Six fixture posts mean page 2 exists and holds exactly the oldest post.
 */
export const POSTS_PAGE_SIZE = 5;

/** Worktable channel fixture (arena.json) — used by /worktable. */
export const worktableChannel = arena.worktable.channel;
export const worktableTextBlock = arena.worktable.textBlock;
export const worktableImageBlock = arena.worktable.imageBlock;

/** Guestbook sign-in form copy, so the spec asserts on a user-visible affordance. */
export const GUESTBOOK_HANDLE_PLACEHOLDER = "user@mastodon.social";

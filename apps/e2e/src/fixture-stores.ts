import { Schema } from "effect";
import { CmsPostSchema, CmsWorkSchema } from "@tom/schemas/cms";
import type { GuestbookEntryJson } from "@tom/types/db";
import type { Product } from "@tom/types/product";
import posts from "../../simulator/fixtures/cms-posts.json" with { type: "json" };
import works from "../../simulator/fixtures/cms-works.json" with { type: "json" };
import guestbookEntries from "../../simulator/fixtures/guestbook-entries.json" with { type: "json" };
import polarProducts from "../../simulator/fixtures/polar-products.json" with { type: "json" };
import arena from "../../simulator/fixtures/arena.json" with { type: "json" };

/**
 * Single source of truth for e2e assertions. The same JSON files back the
 * running simulator (apps/simulator/src/*), so a test asserting on fixture
 * data is asserting on exactly what the page rendered from — not on the wire
 * format, and not on production content. Keep this file free of any URL or
 * header knowledge; it is the "fixture store" contract.
 *
 * Fixture JSON stays dumb data; every store takes its shape from the real
 * shared type — never a redeclared local shape. CMS fixtures decode through
 * their schemas (a direct cast cannot bridge JSON literals to branded
 * schema types), so drift fails fast at import.
 */

export const fixturePosts = Schema.decodeUnknownSync(Schema.Array(CmsPostSchema))(posts);
export const fixtureWorks = Schema.decodeUnknownSync(Schema.Array(CmsWorkSchema))(works);
export const fixtureGuestbookEntries: ReadonlyArray<GuestbookEntryJson> = guestbookEntries;
export const fixturePolarProducts: ReadonlyArray<Product> = polarProducts;

/** The first fixture post is the newest (posts sort by -publishedAt). */
export const newestPost = fixturePosts[0];

/**
 * Posts list paginates at 5 per page (apps/web server/adapter.ts fetchPosts).
 * Six fixture posts mean page 2 exists and holds exactly the oldest post.
 */
export const POSTS_PAGE_SIZE = 5;

/** The oldest fixture post — the only item on /posts page 2. */
export const oldestPost = fixturePosts[fixturePosts.length - 1];

/** Worktable channel fixture (arena.json) — used by /worktable. */
export const worktableChannel = arena.worktable.channel;
export const worktableTextBlock = arena.worktable.textBlock;
export const worktableImageBlock = arena.worktable.imageBlock;

/** Guestbook sign-in form copy, so the spec asserts on a user-visible affordance. */
export const GUESTBOOK_HANDLE_PLACEHOLDER = "user@mastodon.social";

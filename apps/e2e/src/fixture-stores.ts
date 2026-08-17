import posts from "../../simulator/fixtures/payload-posts.json" with { type: "json" };
import works from "../../simulator/fixtures/payload-works.json" with { type: "json" };
import guestbookEntries from "../../simulator/fixtures/guestbook-entries.json" with { type: "json" };
import polarProducts from "../../simulator/fixtures/polar-products.json" with { type: "json" };
import arena from "../../simulator/fixtures/arena.json" with { type: "json" };

/**
 * Single source of truth for e2e assertions. The same JSON files back the
 * running simulator (apps/simulator/src/*), so a test asserting on fixture
 * data is asserting on exactly what the page rendered from — not on the wire
 * format, and not on production content. Keep this file free of any URL or
 * header knowledge; it is the "fixture store" contract.
 */

export type PayloadPostFixture = (typeof posts)[number];
export type PayloadWorkFixture = (typeof works)[number];
export type GuestbookEntryFixture = (typeof guestbookEntries)[number];
export type PolarProductFixture = (typeof polarProducts)[number];

export const fixturePosts = posts;
export const fixtureWorks = works;
export const fixtureGuestbookEntries = guestbookEntries;
export const fixturePolarProducts = polarProducts;

/** The first fixture post is the newest (posts sort by -publishedAt). */
export const newestPost = posts[0];

/**
 * Posts list paginates at 5 per page (apps/web server/adapter.ts fetchPosts).
 * Six fixture posts mean page 2 exists and holds exactly the oldest post.
 */
export const POSTS_PAGE_SIZE = 5;

/** The oldest fixture post — the only item on /posts page 2. */
export const oldestPost = posts[posts.length - 1];

/** Worktable channel fixture (arena.json) — used by /worktable. */
export const worktableChannel = arena.worktable.channel;
export const worktableTextBlock = arena.worktable.textBlock;
export const worktableImageBlock = arena.worktable.imageBlock;

/** Guestbook sign-in form copy, so the spec asserts on a user-visible affordance. */
export const GUESTBOOK_HANDLE_PLACEHOLDER = "user@mastodon.social";

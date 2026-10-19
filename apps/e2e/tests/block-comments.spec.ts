import { test, expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import {
  blockCommentThread,
  nestedChannel,
  newestPost,
  newestPostBlock,
} from "../src/fixture-stores";
import type { ArenaComment } from "../src/fixture-stores";

/**
 * Per-block are.na comments on a post page: the count every commentable block
 * carries, the rail a count opens, and the blocks are.na refuses to comment on
 * (channels hold no block, so they get no affordance at all).
 *
 * Threads come from the fixture simulator, so every assertion is checked
 * against the same JSON the page rendered from.
 */

/** The .content-block wrapper holding one block, addressed by what it renders
 *  — never by index, so inserting a fixture block cannot silently retarget. */
const blockWith = (page: Page, content: Locator): Locator =>
  page.locator(".content-block").filter({ has: content });

const countFor = (page: Page, content: Locator): Locator =>
  blockWith(page, content).locator(".block-comment-trigger");

const railOn = (page: Page): Locator => page.getByRole("complementary", { name: "Block comments" });

/** A fixture comment's body. The fixtures always carry one; a missing body
 *  would otherwise let an assertion pass by rendering nothing. */
const bodyOf = (comment: ArenaComment): string => {
  const plain = comment.body?.plain;
  if (!plain) throw new Error(`fixture comment ${comment.id} has no body`);
  return plain;
};

test.describe("block comments", () => {
  const textBlock = newestPostBlock("Text");
  const imageBlock = newestPostBlock("Image");
  const linkBlock = newestPostBlock("Link");

  const textThread = blockCommentThread(textBlock.id);
  const linkThread = blockCommentThread(linkBlock.id);

  const textContent = (page: Page) =>
    page.getByRole("heading", { name: "Seven systems", level: 2 });
  const imageContent = (page: Page) => page.getByRole("img", { name: "A grail-shaped diagram" });
  const linkContent = (page: Page) => page.getByRole("link", { name: "Unlimited Blade Works" });
  const channelContent = (page: Page) => page.getByRole("link", { name: nestedChannel.title });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/posts/${newestPost.slug}`);
    await expect(page.getByRole("heading", { name: newestPost.title, level: 1 })).toBeVisible();
  });

  test("each commentable block shows its are.na comment count", async ({ page }) => {
    await expect(countFor(page, textContent(page))).toHaveText(String(textThread.length));
    await expect(countFor(page, linkContent(page))).toHaveText(String(linkThread.length));
    await expect(countFor(page, imageContent(page))).toHaveText(String(imageBlock.comment_count));
  });

  test("a channel block gets no comment affordance", async ({ page }) => {
    await expect(blockWith(page, channelContent(page))).toHaveCount(1);
    await expect(countFor(page, channelContent(page))).toHaveCount(0);
  });

  test("opening a count reads that block's are.na thread, signed out", async ({ page }) => {
    await countFor(page, textContent(page)).click();

    const rail = railOn(page);
    await expect(rail).toBeVisible();
    for (const comment of textThread) {
      await expect(rail.getByText(comment.user.name)).toBeVisible();
      await expect(rail.getByText(bodyOf(comment))).toBeVisible();
    }
    await expect(
      rail.getByRole("button", { name: "Sign in with are.na to comment" }),
    ).toBeVisible();
    await expect(rail.getByRole("button", { name: "Delete" })).toHaveCount(0);
  });

  test("a block with no comments reads as empty", async ({ page }) => {
    await countFor(page, imageContent(page)).click();
    await expect(railOn(page).getByText("No comments yet.")).toBeVisible();
  });

  test("opening another block swaps the thread, and Close unpins", async ({ page }) => {
    await countFor(page, textContent(page)).click();
    for (const comment of textThread) {
      await expect(railOn(page).getByText(bodyOf(comment))).toBeVisible();
    }

    await countFor(page, linkContent(page)).click();
    for (const comment of linkThread) {
      await expect(railOn(page).getByText(bodyOf(comment))).toBeVisible();
    }
    for (const comment of textThread) {
      await expect(railOn(page).getByText(bodyOf(comment))).toHaveCount(0);
    }

    await railOn(page).getByRole("button", { name: "Close" }).click();
    await expect(railOn(page)).toHaveCount(0);
  });
});

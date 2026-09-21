import { test, expect } from "@playwright/test";
import {
  nestedChannel,
  nestedChannelBlocks,
  newestPost,
  newestPostBlocks,
} from "../src/fixture-stores";

/**
 * are.na content blocks on a post detail page, driven by the enriched newest
 * fixture post (apps/simulator/fixtures/arena-content.json). Asserts the
 * block types the web renders: markdown text, image, and link.
 */
test.describe("content blocks", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/posts/${newestPost.slug}`);
    await expect(page.getByRole("heading", { name: newestPost.title, level: 1 })).toBeVisible();
  });

  test("renders every block in the channel, in order", async ({ page }) => {
    await expect(page.locator(".content-blocks > div")).toHaveCount(newestPostBlocks.length);
  });

  test("text block renders its markdown HTML", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Seven systems", level: 2, exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/every route is a command seal/i)).toBeVisible();
  });

  test("image block renders the medium source with alt text", async ({ page }) => {
    const image = page.getByRole("img", { name: "A grail-shaped diagram" });
    await expect(image).toHaveAttribute("src", "https://cdn.are.na/grail_medium.jpg");
    await expect(image).toHaveAttribute("srcset", /grail_medium_2x\.jpg 2x/);
  });

  test("link block points at its source", async ({ page }) => {
    const link = page.getByRole("link", { name: "Unlimited Blade Works" });
    await expect(link).toHaveAttribute("href", "https://example.com/unlimited-blade-works");
  });

  // The trigger is a real link so phones fall through to the native viewer,
  // and the panel renders an <embed>: Safari leaves a PDF iframe blank.
  test("pdf attachment opens inline in a dialog", async ({ page }) => {
    await page.getByRole("link", { name: /annotated\.pdf/ }).click();

    const viewer = page.locator('embed[title="The grail war, annotated.pdf"]');
    await expect(viewer).toBeVisible();
    await expect(viewer).toHaveAttribute("src", "https://attachments.are.na/grail-war.pdf");

    await page.getByRole("button", { name: "Close" }).click();
    await expect(viewer).toHaveCount(0);
  });

  test("channel block renders the are.na channel embed", async ({ page }) => {
    const embed = page.locator(".content-blocks div[class*=ring]");
    await expect(embed).toHaveCount(1);
    await expect(embed.getByRole("link", { name: nestedChannel.title })).toBeVisible();
    await expect(embed.getByText("by Tom Hackshaw")).toBeVisible();
    await expect(embed.locator("img")).toHaveCount(nestedChannelBlocks.length);
  });
});

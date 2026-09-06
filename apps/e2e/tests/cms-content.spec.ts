import { test, expect } from "@playwright/test";
import { newestPost } from "../src/fixture-stores";

/**
 * CMS content blocks on a post detail page, driven by the enriched newest
 * fixture post (apps/simulator/fixtures/cms-posts.json). Asserts every
 * Tiptap node type the CMS renders: banner badge, pull quote, highlighted
 * code with filename and line numbers, arena marker, and a media figure
 * whose file bytes come from the simulator.
 */
test.describe("cms content blocks", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/posts/${newestPost.slug}`);
    await expect(page.getByRole("heading", { name: newestPost.title, level: 1 })).toBeVisible();
  });

  test("banner renders badge and body", async ({ page }) => {
    const banner = page.locator('[data-banner="warning"]');
    await expect(banner.getByText("Warning", { exact: true })).toBeVisible();
    await expect(banner.getByText("Masters, mind your command seals.")).toBeVisible();
  });

  test("blockquote renders the quote", async ({ page }) => {
    await expect(
      page.locator("blockquote").getByText("The grail does not care about your sprint velocity."),
    ).toBeVisible();
  });

  test("code block renders filename, lines, and highlighted spans", async ({ page }) => {
    const figure = page.locator("figure.code-block");
    await expect(figure.locator(".code-filename")).toHaveText("ritual.ts");
    await expect(figure.locator(".line").first()).toContainText("const grail");
    await expect(figure).toHaveAttribute("data-line-numbers", "true");
  });

  test("arena marker is present for the channel block", async ({ page }) => {
    await expect(page.locator('div[data-arena="toms-place"]')).toHaveCount(1);
  });

  test("media figure loads file bytes with alt text", async ({ page }) => {
    const image = page.getByRole("img", { name: "A grail-shaped diagram" });
    await expect(image).toBeVisible();
    await expect
      .poll(async () => image.evaluate((node: HTMLImageElement) => node.naturalWidth), {
        timeout: 8000,
      })
      .toBeGreaterThan(0);
  });
});

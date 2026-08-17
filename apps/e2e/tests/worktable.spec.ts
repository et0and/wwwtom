import { test, expect } from "@playwright/test";
import { worktableChannel, worktableTextBlock, worktableImageBlock } from "../src/fixture-stores";

/**
 * /worktable — the Are.na carousel, driven by the arena fixture store. The
 * channel slug (tom-s-worktable) is a fixture channel; text blocks render
 * their content html, image blocks render the image with the title as alt.
 */
test.describe("worktable", () => {
  test("headline and channel copy render", async ({ page }) => {
    await page.goto("/worktable");
    await expect(page.getByRole("heading", { name: "Worktable", level: 1 })).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "What I am currently working on or interested in",
        level: 2,
      }),
    ).toBeVisible();
  });

  test("the carousel shows fixture blocks and links to the source channel", async ({ page }) => {
    await page.goto("/worktable");

    await expect(page.getByText(worktableTextBlock.content.plain)).toBeVisible();
    await expect(page.getByRole("img", { name: worktableImageBlock.title })).toBeVisible();

    await expect(page.getByRole("link", { name: worktableChannel.title })).toHaveAttribute(
      "href",
      `https://are.na/tom/${worktableChannel.slug}`,
    );
  });
});

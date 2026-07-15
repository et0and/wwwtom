import { test, expect } from "@playwright/test";

test.describe("posts index", () => {
  test("resolves and loads content", async ({ page }) => {
    await page.goto("/posts");

    await expect(page).toHaveTitle("Writing | Tom Hackshaw");
    await expect(page.locator("main h1")).toContainText("Writing");
    await expect(page.locator("body")).toContainText("Some of my writing.");

    const postLinks = page.locator("main a[href^='/posts/']");
    await expect(postLinks.first()).toBeVisible();
  });
});

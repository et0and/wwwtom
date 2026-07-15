import { test, expect } from "@playwright/test";

test.describe("work index", () => {
  test("resolves and loads content", async ({ page }) => {
    await page.goto("/work");

    await expect(page).toHaveTitle("Work | Tom Hackshaw");
    await expect(page.locator("main h1")).toContainText("Work");
    await expect(page.locator("body")).toContainText("Some work that I have made.");

    const workLinks = page.locator("main a[href^='/work/']");
    await expect(workLinks.first()).toBeVisible();
  });
});

test.describe("work detail page", () => {
  test("loads a specific work and renders arena content", async ({ page }) => {
    await page.goto("/work/an-idea-for-a-performance");

    await expect(page).toHaveTitle("An idea for a performance | Tom Hackshaw");
    await expect(page.locator("main h1")).toContainText("An idea for a performance");
    await expect(page.locator("main")).toContainText("A tool for generating performance ideas.");
    await expect(page.locator("main")).toContainText(
      "An idea for a performance is a web experiment and are.na channel",
    );

    await expect(page.locator("main")).toContainText("Source: An idea for a performance");
    const sourceLink = page.locator("a[href='https://are.na/tom/an-idea-for-a-performance']");
    await expect(sourceLink).toBeVisible();

    const carouselItems = page.locator("main .carousel-item");
    await expect(carouselItems.first()).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";

test.describe("home page", () => {
  test("resolves and shows expected content", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("Home | Tom Hackshaw");
    await expect(page.locator("body")).toContainText("Hi, I'm Tom,");
    await expect(page.locator("body")).toContainText(
      "I'm a software engineer with a background in the arts and education.",
    );
  });

  test("renders main navigation links", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Tom Hackshaw" })).toHaveAttribute("href", "/");
    await expect(page.getByRole("link", { name: "Work" })).toHaveAttribute("href", "/work");
    await expect(page.getByRole("link", { name: "Writing" })).toHaveAttribute("href", "/posts");
  });
});

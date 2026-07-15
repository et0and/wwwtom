import { test, expect } from "@playwright/test";

test.describe("not found routes", () => {
  test("renders a not-found page for an unknown route", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");

    await expect(page).toHaveTitle("404 | Tom Hackshaw");
    await expect(page.locator("main")).toContainText("Not found");
  });
});

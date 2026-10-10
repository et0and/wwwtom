import { test, expect } from "@playwright/test";
import { expectNoPageErrors } from "../src/helpers";

/**
 * Static pages and site chrome. These pages don't read any service data, so
 * they're the cheapest health check for the nightly run: if routing, SSR or
 * the header plumbing broke, these fail first.
 */
test.describe("site chrome", () => {
  test("home page renders intro and nav", async ({ page }) => {
    const assertNoErrors = expectNoPageErrors(page);
    await page.goto("/");
    await expect(
      page.getByText("I'm a software engineer with a background in the arts and education."),
    ).toBeVisible();
    await expect(page.getByText(/Currently based in Pōneke/)).toBeVisible();

    // Nav + footer affordances.
    await expect(page.getByRole("heading", { name: "Tom Hackshaw", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Work" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Writing" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Accessibility" })).toBeVisible();
    assertNoErrors();
  });

  test("about page", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "About", level: 1 })).toBeVisible();
    await expect(page.getByText("Elam School of Fine Arts")).toBeVisible();
  });

  test("accessibility statement page", async ({ page }) => {
    await page.goto("/accessibility");
    await expect(page.getByRole("heading", { name: "Accessibility", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /access@tomhackshaw.com/ })).toBeVisible();
  });

  test("garden page lists the generative pieces", async ({ page }) => {
    const assertNoErrors = expectNoPageErrors(page);
    await page.goto("/work/wwwork/garden");
    await expect(page.getByRole("heading", { name: "Garden", level: 1 })).toBeVisible();
    for (const title of ["Drift", "Halo", "After Rain", "Canon", "Low", "Dust"]) {
      await expect(page.getByRole("heading", { name: title, level: 3 })).toBeVisible();
    }
    assertNoErrors();
  });

  test("unknown route renders the 404 page", async ({ page }) => {
    await page.goto("/definitely-not-a-page");
    await expect(page.locator("main")).toContainText("Not found");
  });
});

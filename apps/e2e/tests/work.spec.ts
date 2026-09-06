import { test, expect } from "@playwright/test";
import { fixtureWorks } from "../src/fixture-stores";

/**
 * /work — the Work index and project pages, driven by the CMS fixture
 * store. Works sort alphabetically by title (the real API contract, mirrored
 * by the simulator); a detail page renders the stored body.
 */
test.describe("work", () => {
  test("work index lists every fixture project", async ({ page }) => {
    await page.goto("/work");
    await expect(page.getByRole("heading", { name: "Work", level: 1 })).toBeVisible();

    for (const work of fixtureWorks) {
      await expect(page.getByRole("heading", { name: work.title, level: 2 })).toBeVisible();
    }
  });

  test("work index sorts alphabetically by title", async ({ page }) => {
    await page.goto("/work");
    const titles = await page.getByRole("heading", { level: 2 }).allTextContents();
    const expected = fixtureWorks
      .map((work) => work.title)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    expect(titles).toEqual(expected);
  });

  test("a project detail page renders title and body", async ({ page }) => {
    const work = fixtureWorks[0];
    await page.goto(`/work/${work.slug}`);
    await expect(page.getByRole("heading", { name: work.title, level: 1 })).toBeVisible();
    await expect(page.getByText(/reality marble full of traced artifacts/i)).toBeVisible();
  });

  test("a second project renders its own body", async ({ page }) => {
    const work = fixtureWorks[1];
    await page.goto(`/work/${work.slug}`);
    await expect(page.getByRole("heading", { name: work.title, level: 1 })).toBeVisible();
    await expect(page.getByText(/mapo tofu.*mystery curry/i)).toBeVisible();
  });

  test("an unknown project slug renders the not-found state", async ({ page }) => {
    await page.goto("/work/not-a-real-project");
    await expect(page.locator("main")).toContainText("Not found");
  });
});

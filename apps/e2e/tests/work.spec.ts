import { test, expect } from "@playwright/test";
import { fixtureWorks } from "../src/fixture-stores";

/**
 * /work — the Work index and project pages, driven by the are.na fixture
 * store (fixtures/arena-content.json). Order is the manual connection order
 * in the master channel; a detail page renders the channel's blocks.
 */
test.describe("work", () => {
  test("work index lists every fixture project", async ({ page }) => {
    await page.goto("/work");
    await expect(page.getByRole("heading", { name: "Work", level: 1 })).toBeVisible();

    for (const work of fixtureWorks) {
      await expect(page.getByRole("heading", { name: work.title, level: 2 })).toBeVisible();
    }
  });

  test("work index follows the master channel order", async ({ page }) => {
    await page.goto("/work");
    const titles = await page.getByRole("heading", { level: 2 }).allTextContents();
    expect(titles).toEqual(fixtureWorks.map((work) => work.title));
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

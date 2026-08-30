import { test, expect, type Page } from "@playwright/test";
import { expectNoPageErrors } from "../src/helpers";

/**
 * Real-data flows against the staging stage: list pages hydrate live CMS /
 * Polar / arena content through the adapter, and read-only navigation into
 * the first detail page works. Nothing submits — the guestbook and checkout
 * flows mutate real data, so they are only rendered, never signed/submitted.
 */

const expectNoErrors = async (page: Page): Promise<void> => {
  await expectNoPageErrors(page)();
};

const FIRST_DETAIL_HREF = /\/posts\/[^/?]/;

test.describe("staging real data", () => {
  test("posts index hydrates the CMS list and a detail page renders", async ({ page }) => {
    await page.goto("/posts");
    await expect(page.getByRole("heading", { name: "Writing", level: 1 })).toBeVisible();

    // Content arrives on hydration; require at least one real post link.
    const postLink = page.locator(`a[href^="/posts/"]`).first();
    await expect(postLink).toBeVisible();

    await postLink.click();
    await expect(page).toHaveURL(FIRST_DETAIL_HREF);
    await expect(page.getByRole("article")).toBeVisible();
    await expect(page).toHaveTitle(/Tom Hackshaw/);
    await expectNoErrors(page);
  });

  test("work index hydrates the CMS list and a detail page renders", async ({ page }) => {
    await page.goto("/work");
    await expect(page.getByRole("heading", { name: "Work", level: 1 })).toBeVisible();

    const workLink = page.locator(`a[href^="/work/"]`).first();
    await expect(workLink).toBeVisible();

    await workLink.click();
    await expect(page.url()).toMatch(/\/work\/[^/?]/);
    await expect(page.getByRole("article")).toBeVisible();
    await expectNoErrors(page);
  });

  test("products page settles into a valid state", async ({ page }) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();

    const purchaseLink = page.locator(`a[href^="/purchase/"]`).first();
    const hasProducts = (await purchaseLink.count()) > 0;
    if (hasProducts) {
      // Polar has products: exercise the read-only purchase page (no submit).
      await purchaseLink.click();
      await expect(page.url()).toMatch(/\/purchase\/[^/?]/);
      await expect(page.getByRole("button", { name: "Proceed to payment" })).toBeVisible();
    } else {
      // Either the empty state or the upstream-failure fallback is a valid
      // settled page; a hang or a blank body is not.
      await expect
        .poll(async () => {
          const empty = await page.getByText("No products available").isVisible();
          const errored = await page.getByText("Failed to load products").isVisible();
          return empty || errored;
        })
        .toBe(true);
    }
    await expectNoErrors(page);
  });

  test("guestbook page renders without signing", async ({ page }) => {
    await page.goto("/guestbook");
    await expect(page.getByRole("heading", { name: "Guestbook", level: 1 })).toBeVisible();

    // Either the sign-in form (anonymous) or the signed-in composer renders.
    const handleInput = page.locator('[name="handle"]');
    if (await handleInput.count()) {
      await expect(handleInput).toBeVisible();
    } else {
      await expect(page.locator('textarea[name="message"]')).toBeVisible();
    }
    await expectNoErrors(page);
  });
});

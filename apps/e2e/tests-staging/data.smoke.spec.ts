import { test, expect, type Page } from "@playwright/test";
import { expectNoPageErrors, fetchWithBackoff } from "../src/helpers";

/**
 * Real-data flows against the staging stage: list pages hydrate live CMS /
 * arena content through the adapter, and read-only navigation into the first
 * detail page works. Nothing submits — the guestbook flow mutates real data,
 * so it is only rendered, never signed/submitted.
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

  test("guestbook entries API returns an entry list from the stage database", async ({
    request,
  }) => {
    // Regression cover for the missing-table outage: the bundle pointed at
    // a database without guestbook tables, so this answered 5xx (then 4xx
    // under problem details) instead of an entry list on every stage. The
    // read path flaps transiently through Hyperdrive, so poll for a healthy
    // answer: a persistent outage fails every attempt and goes red.
    test.setTimeout(180_000);
    const adapter = process.env.E2E_STAGING_ADAPTER_URL ?? "https://staging-adapter.tom.so";
    await expect
      .poll(
        async () => {
          const response = await fetchWithBackoff(request, `${adapter}/guestbook/entries`);
          const body = await response.json().catch(() => null);
          return { status: response.status(), isList: Array.isArray(body) };
        },
        { message: "guestbook entries must answer 200 with a list", timeout: 120_000 },
      )
      .toEqual({ status: 200, isList: true });
  });
});

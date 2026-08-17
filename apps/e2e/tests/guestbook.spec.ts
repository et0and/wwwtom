import { test, expect } from "@playwright/test";
import { fixtureGuestbookEntries, GUESTBOOK_HANDLE_PLACEHOLDER } from "../src/fixture-stores";

/**
 * /guestbook — entries come from the guestbook fixture store (the adapter's
 * simulator branch replaces D1). The Fediverse OAuth sign-in flow is external
 * by design, so this suite asserts the read path and the sign-in affordances,
 * not a completed auth.
 *
 * Entry data is fetched client-side after hydration, so assertions rely on
 * Playwright's auto-waiting rather than SSR content. The file is serial
 * because future sign-in tests will mutate the simulator's in-memory store.
 */
test.describe("guestbook", () => {
  test.describe.configure({ mode: "serial" });

  test("every fixture signature renders", async ({ page }) => {
    await page.goto("/guestbook");
    await expect(page.getByRole("heading", { name: "Guestbook", level: 1 })).toBeVisible();
    // Entries load client-side after hydration (browser -> adapter -> sim); on
    // a cold dev route the first render can take a couple of seconds.
    await expect(page.locator(".guestbook-entry").first()).toBeVisible({ timeout: 20_000 });

    for (const entry of fixtureGuestbookEntries) {
      await expect(page.getByText(entry.message)).toBeVisible();
      // The page renders the entry's fediverse_username (the full handle)
      // directly next to its message.
      await expect(
        page
          .locator(".guestbook-entry", { hasText: entry.message })
          .getByText(entry.fediverse_username),
      ).toBeVisible();
    }
  });

  test("the sign-in affordance is present when signed out", async ({ page }) => {
    await page.goto("/guestbook");
    await expect(page.getByText(/Sign in with your Fediverse account/i)).toBeVisible();
    await expect(page.getByPlaceholder(GUESTBOOK_HANDLE_PLACEHOLDER)).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("the signatures list is driven by the fixture store", async ({ page }) => {
    // The store always has entries; the empty state is the simulator's
    // concern. Here we just confirm the list renders after hydration.
    await page.goto("/guestbook");
    await expect(page.locator(".guestbook-entry")).toHaveCount(fixtureGuestbookEntries.length);
  });
});

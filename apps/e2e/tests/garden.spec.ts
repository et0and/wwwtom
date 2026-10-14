import { test, expect, type Route } from "@playwright/test";

/**
 * /work/wwwork/garden — the generative-music player. Garden has no upstream
 * service, so instead of a fixture store its deterministic inputs are the
 * seed words in the URL and the player's own tiles. The real Tone engine
 * loads in the browser: a click starts the audio graph and the piece id
 * lands in the URL, which the suite pins without asserting audio.
 */
const TITLES = ["Drift", "Halo", "After Rain", "Canon", "Low", "Dust", "Static", "Haze", "Gust"];

/** 1x1 red PNG: cover art bytes so tiles render without the real CDN. */
const RED_PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const GARDEN_PATH = "/work/wwwork/garden";

test.describe("garden", () => {
  // Keep the suite hermetic: cover art comes from cdn.tom.so in production;
  // a tiny stand-in PNG serves it without network.
  test.beforeEach(async ({ page }) => {
    await page.route("https://cdn.tom.so/**", (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: RED_PIXEL_PNG }),
    );
  });

  test("lists every piece in display order", async ({ page }) => {
    await page.goto(GARDEN_PATH);
    await expect(page.getByRole("heading", { name: "Garden", level: 1 })).toBeVisible();
    await expect(page.locator("button[aria-pressed]")).toHaveCount(TITLES.length);
    const labels = await page
      .locator("button[aria-pressed]")
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
    expect(labels).toEqual(TITLES.map((title) => `Play ${title}`));
  });

  test("plays the piece for the seed in the URL", async ({ page }) => {
    await page.goto(`${GARDEN_PATH}?seed=planet`);
    await expect(page.getByLabel("Seed")).toHaveValue("planet");

    await page.getByRole("button", { name: "Play Drift" }).click();
    await expect(page.getByRole("button", { name: "Stop Drift" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // The seed survives; the playing piece is shareable through the URL.
    await expect(page).toHaveURL(/seed=planet/);
    await expect(page).toHaveURL(/piece=drift/);

    await page.getByRole("button", { name: "Stop Drift" }).click();
    await expect(page).not.toHaveURL(/piece=/);
  });

  test("draws a random seed when the URL has none", async ({ page }) => {
    await page.goto(GARDEN_PATH);
    // Rendered on the server as "solstice"; hydration replaces it with a
    // fresh 12-hex-digit seed, so no two visits replay the same piece.
    const seed = page.getByLabel("Seed");
    await expect(seed).toHaveValue(/^[0-9a-f]{12}$/);
    const before = await seed.inputValue();
    await expect(page).toHaveURL(new RegExp(`seed=${before}`));

    await page.getByRole("button", { name: "New seed" }).click();
    await expect.poll(() => seed.inputValue()).not.toBe(before);
    const after = await seed.inputValue();
    await expect(page).toHaveURL(new RegExp(`seed=${after}`));
  });
  test("surfaces an engine load failure as an alert", async ({ page }) => {
    // The Tone module is the engine's dynamic import; aborting its chunk
    // makes the first click fail the way a blocked CDN would. The browser
    // module map caches a failed chunk, so the retry path (unit-tested with
    // an injected engine) is out of reach here — the user-visible part is
    // the alert, and the player staying silent instead of crashing.
    await page.route(/\.vite\/deps\/tone/, (route: Route) => route.abort());
    await page.goto(GARDEN_PATH);
    await expect(page.getByLabel("Seed")).toHaveValue(/^[0-9a-f]{12}$/);

    await page.getByRole("button", { name: "Play Drift" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  });
});

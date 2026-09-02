import { test, expect, type Page } from "@playwright/test";
import { expectNoPageErrors, fetchWithBackoff, gotoWithBackoff } from "../src/helpers";

/**
 * Content-agnostic smoke tests against the deployed staging site. These
 * assert structure and behavior only — no fixture titles or IDs, so they
 * pass against whatever real data the staging stage holds.
 *
 * CI runs the suite from GitHub-hosted runner IPs, which Cloudflare bot
 * protection intermittently fast-blocks (403) or answers with its Managed
 * Challenge interstitial. The fetch/goto helpers below back off and retry
 * on those transient responses; config-level retries (staging config) cover
 * the remaining tests.
 */

const expectNoErrors = async (page: Page): Promise<void> => {
  const noErrors = expectNoPageErrors(page);
  await noErrors();
};

test.describe("staging site chrome", () => {
  test("home page renders and serves head meta", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Tom Hackshaw/);
    await expect(page.getByRole("link", { name: "Work" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Writing" })).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();

    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveCount(1);
    const href = await ogImage.getAttribute("content");
    expect(href).toMatch(/^https:\/\/adapter\.tom\.so\/og\?title=/);
    await expectNoErrors(page);
  });

  test("static routes render their headings", async ({ page }) => {
    // Backoff retries against the challenge interstitial can add ~14s per
    // challenged route, so this loop gets a budget beyond the 30s default.
    test.setTimeout(60_000);
    for (const [path, heading] of [
      ["/about", "About"],
      ["/accessibility", "Accessibility"],
      ["/thanks", "Thank you!"],
      ["/worktable", "Worktable"],
    ] as const) {
      await gotoWithBackoff(page, path);
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
      await expectNoErrors(page);
    }
  });

  test("unknown routes render the 404 page with a 404 status", async ({ page }) => {
    const response = await page.goto("/definitely-not-a-real-page");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("main")).toContainText("Not found");
    await expectNoErrors(page);
  });
});

test.describe("staging public endpoints", () => {
  test("robots.txt is served", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("Sitemap:");
  });

  test("the RSS feed is valid XML with posts from the stage's CMS", async ({ request }) => {
    const response = await fetchWithBackoff(request, "/feed.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/rss+xml");
    const body = await response.text();
    expect(body).toContain("<channel>");
    // Production/staging has real posts; zero items would mean an empty CMS.
    expect((body.match(/<item>/g) ?? []).length).toBeGreaterThan(0);
  });

  test("the sitemap lists live URLs", async ({ request }) => {
    const response = await fetchWithBackoff(request, "/sitemap.xml");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain('<?xml version="1.0"');
    expect((body.match(/<loc>/g) ?? []).length).toBeGreaterThan(0);
    expect(body).toContain("https://tom.so/");
  });

  test("og:image meta points at the adapter and the stage og chain works", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    const href = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(href).toMatch(/^https:\/\/adapter\.tom\.so\/og\?title=/);

    // Exercise the stage's own og chain (adapter → API) with the home
    // summary, which contains a comma — the exact regression the fix
    // landed for. The meta itself points at the production proxy, so
    // asserting the stage's direct endpoint keeps this check independent
    // of the production deploy state.
    const adapter = process.env.E2E_STAGING_ADAPTER_URL ?? "https://staging-adapter.tom.so";
    const response = await fetchWithBackoff(
      request,
      `${adapter}/og?title=Home&summary=Tom%20Hackshaw%20is%20a%20design%20engineer%20from%20Aotearoa%2C%20New%20Zealand`,
    );
    expect(response.status(), "stage og image must generate").toBe(200);
    expect(response.headers()["content-type"]).toContain("image/");
  });
});

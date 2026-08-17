import { test, expect, type Page } from "@playwright/test";
import { fixturePolarProducts } from "../src/fixture-stores";

/**
 * /products and /purchase — the store, driven by the polar fixture store.
 * formatPrice renders cents as `$${cents / 100}` (e.g. $35 for 3500).
 *
 * The purchase flow ends in a redirect to checkout.simulator.dev, which does
 * not exist on the network; the checkout URL is intercepted and asserted —
 * the test verifies the browser was pointed at a checkout for the right
 * product and customer, not that a payment provider is reachable.
 */

const checkoutUrl = (productId: string) => `/purchase/${productId}`;

const interceptCheckout = (page: Page) =>
  page.route("https://checkout.simulator.dev/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "e2e checkout stub" }),
  );

test.describe("store", () => {
  test("products page lists fixture products with prices", async ({ page }) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();

    for (const product of fixturePolarProducts) {
      await expect(page.getByRole("heading", { name: product.name, level: 2 })).toBeVisible();
      await expect(page.getByText(product.description)).toBeVisible();
      const price = product.prices?.[0]?.price_amount;
      if (price !== undefined) {
        await expect(page.getByText(`$${price / 100}`)).toBeVisible();
      }
    }
    await expect(page.getByRole("link", { name: "Purchase now" })).toHaveCount(
      fixturePolarProducts.length,
    );
  });

  test("purchase page shows the chosen product", async ({ page }) => {
    const product = fixturePolarProducts[0];
    await page.goto(checkoutUrl(product.id));
    await expect(
      page.getByRole("heading", { name: "Complete your purchase", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(product.description)).toBeVisible();
  });

  test("purchase form validates the email", async ({ page }) => {
    await page.goto(checkoutUrl(fixturePolarProducts[0].id));
    await page.getByPlaceholder("john@email.com").fill("not-an-email");
    await page.getByRole("button", { name: /proceed to payment/i }).click();
    await expect(page.getByText(/valid email address/i)).toBeVisible();
  });

  test("a valid purchase redirects to the product checkout", async ({ page }) => {
    await interceptCheckout(page);
    const product = fixturePolarProducts[0];

    await page.goto(checkoutUrl(product.id));
    await page.getByPlaceholder("john@email.com").fill("e2e-buyer@example.com");
    await page.getByPlaceholder("John Product").fill("E2E Buyer");
    // The submit button is disabled until the product resource resolves; the
    // first server-function call on a cold dev server can compile slowly.
    const proceed = page.getByRole("button", { name: /proceed to payment/i });
    await expect(proceed).toBeEnabled({ timeout: 20_000 });

    // The adapter creates a Polar customer (simulated), then its
    // /polar/checkout proxy 302-redirects the browser to the (simulated)
    // checkout URL. Assert the redirect response directly — the external
    // checkout.simulator.dev URL isn't real, so we verify the adapter forwards
    // the Location rather than following it to the network.
    const [checkoutResponse] = await Promise.all([
      page.waitForResponse((r) => r.request().url().includes("/polar/checkout")),
      proceed.click(),
    ]);
    expect(checkoutResponse.status()).toBe(302);
    const location = checkoutResponse.headers()["location"] ?? "";
    expect(location).toContain("https://checkout.simulator.dev/pay");
    expect(location).toContain(`products=${product.id}`);
    expect(location).toContain("customerId=");
    expect(location).toContain("theme=light");
  });
});

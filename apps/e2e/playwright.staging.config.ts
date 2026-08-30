import { defineConfig, devices } from "@playwright/test";

/**
 * Nightly staging suite: runs against the deployed `staging` Alchemy stage
 * (real upstreams — payload/Polar/arena live data, no fixture simulator).
 * Separate from the fixture suite (`playwright.config.ts`): no local
 * webServers, no `x-use-simulator` header, and a different test directory
 * whose assertions are content-agnostic.
 *
 * Override the target with E2E_STAGING_URL (default the staging web host).
 */
const WEB_URL = process.env.E2E_STAGING_URL ?? "https://staging-web.tom.so";

export default defineConfig({
  testDir: "./tests-staging",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: WEB_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

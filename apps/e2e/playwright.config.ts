import { defineConfig, devices } from "@playwright/test";

/**
 * Nightly e2e suite for tom.so.
 *
 * Topology (all local, in order of startup):
 *   simulator (8789)  ← fixture stores: polar, arena, payload, guestbook, api
 *   adapter   (8788)  ← real adapter Worker entry run under tsx (env attaches
 *                       SIMULATOR_URL; the x-use-simulator header does the swap)
 *   web       (3000)  ← `vite preview` of the production build; built with
 *                       VITE_ADAPTER_URL=http://127.0.0.1:8788
 *
 * Every browser request carries `x-use-simulator: 1` (extraHTTPHeaders), so
 * both browser→adapter calls (guestbook) and SSR web→adapter calls (posts,
 * work, products, arena — forwarded by apps/web/src/libs/adapter.ts) hit the
 * fixture data. Production never sets SIMULATOR_URL, so the header is inert
 * there.
 */

const SIMULATOR_URL = "http://127.0.0.1:8789";
const ADAPTER_URL = "http://127.0.0.1:8788";
const WEB_URL = "http://127.0.0.1:3000";
const IS_CI = process.env.CI === "true" || process.env.CI === "1";

export default defineConfig({
  testDir: "./tests",
  // Fully parallel: Solid 2 request scopes are async-local
  // (provideRequestEvent via node:async_hooks), so concurrent SSR renders
  // no longer trample module-level sharedConfig. The web app gives each
  // request its own query cache (middleware · locals.queryClient), so
  // parallel pages never share TanStack state. Workers default to half the
  // host's cores; CI stays reliable with retries.
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: WEB_URL,
    // The suite is service-agnostic: this header is the only test-private
    // thing on the wire. Assertions never mention it.
    extraHTTPHeaders: { "x-use-simulator": "1" },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @tom/simulator start",
      url: `${SIMULATOR_URL}/v3/channels/toms-place`,
      reuseExistingServer: !IS_CI,
      timeout: 60_000,
    },
    {
      command: `SIMULATOR_URL=${SIMULATOR_URL} pnpm --filter @tom/e2e exec tsx server/adapter.ts`,
      url: `${ADAPTER_URL}/payload/posts?page=1&pageSize=1`,
      reuseExistingServer: !IS_CI,
      timeout: 60_000,
    },
    {
      // `vite dev`: vite (unlike our custom-node serving) drives Solid Meta's
      // head injection, so titles/meta/hydration are faithful (verified on
      // live tom.so). Runs with serial workers (SolidJS SSR isn't
      // concurrency-safe), so no framework patch is needed.
      // --host 127.0.0.1: vite binds to ::1 (IPv6) by default on macOS;
      // Playwright probes and drives 127.0.0.1.
      command: "pnpm --filter @tom/web exec vite dev --host 127.0.0.1 --port 3000 --strictPort",
      url: `${WEB_URL}/robots.txt`,
      reuseExistingServer: !IS_CI,
      timeout: 60_000,
    },
  ],
});

import { defineConfig, devices } from "@playwright/test";

/**
 * E2E suites for tom.so (all local).
 *
 * Topology (in order of startup):
 *   simulator (8789)  ← fixture stores: polar, arena, cms, guestbook, api
 *   adapter   (8788)  ← real adapter Worker entry run under tsx (env attaches
 *                       SIMULATOR_URL; the x-use-simulator header does the swap)
 *   web       (3000)  ← `vite dev` of apps/web (see below for why dev)
 *   editor    (5174)  ← `vite dev` of apps/editor
 *
 * Two projects share this config:
 * - fixture: every page on tom.so against the fixture stack. Every browser
 *   request carries `x-use-simulator: 1` (extraHTTPHeaders), so both
 *   browser→adapter calls (guestbook) and SSR web→adapter calls (posts,
 *   work, products, arena) hit the fixture data. Production never sets
 *   SIMULATOR_URL, so the header is inert there.
 * - editor: the Camus SPA with every adapter call intercepted per test
 *   (VITE_ADAPTER_URL falls back to localhost:8788, which never needs to
 *   exist). GitHub OAuth cannot run headless, so `/auth/get-session`
 *   yields a fixture session (or null); write bodies are asserted, pinning
 *   the exact API contract the editor speaks.
 */

const SIMULATOR_URL = "http://127.0.0.1:8789";
const ADAPTER_URL = "http://127.0.0.1:8788";
const WEB_URL = "http://127.0.0.1:3000";
const EDITOR_URL = "http://127.0.0.1:5174";
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
  projects: [
    {
      name: "fixture",
      testIgnore: ["editor.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: WEB_URL,
        // The suite is service-agnostic: this header is the only test-private
        // thing on the wire. Assertions never mention it.
        extraHTTPHeaders: { "x-use-simulator": "1" },
        trace: "on-first-retry",
        screenshot: "only-on-failure",
        video: "off",
      },
    },
    {
      name: "editor",
      testMatch: ["editor.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: EDITOR_URL,
        trace: "on-first-retry",
        screenshot: "only-on-failure",
        video: "off",
      },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @tom/simulator start",
      url: `${SIMULATOR_URL}/v3/channels/toms-place`,
      reuseExistingServer: !IS_CI,
      timeout: 60_000,
    },
    {
      command: `SIMULATOR_URL=${SIMULATOR_URL} pnpm --filter @tom/e2e exec tsx server/adapter.ts`,
      url: `${ADAPTER_URL}/content/posts?page=1&pageSize=1`,
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
    {
      command: "pnpm --filter @tom/editor exec vite dev --host 127.0.0.1 --port 5174 --strictPort",
      url: `${EDITOR_URL}/`,
      reuseExistingServer: !IS_CI,
      timeout: 60_000,
    },
  ],
});

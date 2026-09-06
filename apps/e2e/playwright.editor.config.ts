import { defineConfig, devices } from "@playwright/test";

/**
 * Editor (Camus) e2e suite.
 *
 * Topology (all local):
 *   editor (5174) ← `vite dev` of apps/editor; VITE_ADAPTER_URL falls back
 *                    to http://localhost:8788, which never needs to exist:
 *                    every adapter call is intercepted per test.
 *
 * Auth is the only hard boundary: GitHub OAuth cannot run headless, so each
 * authed test stubs `/auth/get-session` with a fixture session and drives
 * the CMS UI against intercepted `/content/*` responses. Request bodies on
 * writes are asserted, so the specs pin the exact API contract the editor
 * speaks — the same shapes apps/api validates.
 */

const EDITOR_URL = "http://127.0.0.1:5174";
const IS_CI = process.env.CI === "true" || process.env.CI === "1";

export default defineConfig({
  testDir: "./tests-editor",
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: EDITOR_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @tom/editor exec vite dev --host 127.0.0.1 --port 5174 --strictPort",
      url: `${EDITOR_URL}/`,
      reuseExistingServer: !IS_CI,
      timeout: 60_000,
    },
  ],
});

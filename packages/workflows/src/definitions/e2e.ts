import { step, workflow } from "../builders";
import { actionPins, checkout, setupStep } from "../catalog/actions";

/**
 * Runs the Playwright suite daily and on every PR against dev. No `push`
 * trigger: the merged dev commit already ran green as the last PR state, so
 * post-merge re-runs would be wasted.
 */
export const e2e = workflow("e2e", {
  name: "E2E (fixture store)",
  on: {
    schedule: [{ cron: "17 2 * * *" }],
    workflow_dispatch: null,
    pull_request: { branches: ["dev"] },
  },
  permissions: { contents: "read", actions: "read" },
  // One run per PR number (cancelled on newer pushes) and per ref for
  // scheduled and manual runs, so overlapping runs cannot queue up.
  concurrency: {
    group: "e2e-${{ github.event.pull_request.number || github.ref }}",
    "cancel-in-progress": true,
  },
  jobs: {
    playwright: {
      name: "Playwright (tom.so fixture store)",
      "runs-on": "ubuntu-latest",
      "timeout-minutes": 30,
      steps: [
        checkout(),
        setupStep({ "install-playwright": "true" }),
        // The web server under test is `vite dev` (not preview — see
        // apps/e2e/playwright.config.ts), so no production build is needed.
        step({
          name: "Run e2e suite",
          run: "pnpm --filter @tom/e2e test:e2e",
          env: { CI: "true", SIMULATOR_URL: "http://127.0.0.1:8789" },
        }),
        step({
          name: "Upload Playwright report",
          if: "failure()",
          uses: actionPins.uploadArtifact,
          with: {
            name: "playwright-report",
            path: "apps/e2e/playwright-report/",
            "retention-days": 7,
          },
        }),
        step({
          name: "Upload test traces",
          if: "failure()",
          uses: actionPins.uploadArtifact,
          with: {
            name: "test-results",
            path: "apps/e2e/test-results/",
            "retention-days": 7,
          },
        }),
      ],
    },
  },
});

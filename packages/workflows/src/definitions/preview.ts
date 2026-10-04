import { run, step, workflow } from "../builders";
import { actionPins, checkout, setupStep } from "../catalog/actions";
import { deployChain, previewStacks, destroyStacks, destroySteps } from "../catalog/alchemy";
import {
  closedAction,
  notClosedAction,
  previewAdapterUrl,
  previewConcurrencyGroup,
  previewEnv,
  previewWebUrl,
  prStage,
} from "../catalog/preview";

/**
 * PR preview: deploy the full stack on every push to a PR, tear it down when
 * the PR closes, then smoke-test what was actually deployed.
 *
 * The comment is posted by the `preview` stack, which runs last in the chain
 * and owns a single consolidated comment for the whole stage.
 */
export const preview = workflow("preview", {
  name: "PR preview",
  on: {
    pull_request: {
      types: ["opened", "synchronize", "reopened", "closed"],
      branches: ["dev"],
    },
  },
  permissions: { contents: "read", issues: "write", "pull-requests": "write" },
  concurrency: { group: previewConcurrencyGroup, "cancel-in-progress": true },
  jobs: {
    deploy: {
      if: notClosedAction,
      name: "Deploy PR preview",
      "runs-on": "ubuntu-latest",
      env: previewEnv(prStage),
      steps: [
        // Full history so `git describe --tags` can stamp the release version
        // into the web build.
        checkout("Checkout", { "fetch-depth": 0 }),
        setupStep(),
        run("Deploy preview stage", deployChain(previewStacks)),
      ],
    },
    smoke: {
      // The fixture e2e suite proves the code works; only this proves the
      // deployed preview works. Without it a green PR can still point at a
      // broken stage.
      needs: "deploy",
      name: "Smoke test the preview",
      "runs-on": "ubuntu-latest",
      "timeout-minutes": 15,
      // Report-only for now. Cloudflare bot protection answers 403 to the
      // raw APIRequestContext calls from a GitHub runner IP, and holds
      // navigations at the interstitial, so this job is red for reasons that
      // have nothing to do with the branch. `continue-on-error` keeps it
      // visible without making every PR fail. Drop it once a WAF rule skips
      // bot management for CI, and this becomes a real gate.
      "continue-on-error": true,
      steps: [
        checkout(),
        setupStep({ "install-playwright": "true" }),
        step({
          name: "Run staging smoke suite against the preview",
          // Same content-agnostic suite as the nightly staging run, aimed at
          // this PR's hosts. `CI` turns on the config retries that absorb
          // Cloudflare bot protection from a runner IP.
          run: "pnpm --filter @tom/e2e test:e2e:staging",
          env: {
            CI: "true",
            E2E_STAGING_URL: previewWebUrl,
            E2E_STAGING_ADAPTER_URL: previewAdapterUrl,
          },
        }),
        step({
          name: "Upload Playwright report",
          if: "failure()",
          uses: actionPins.uploadArtifact,
          with: {
            name: "preview-smoke-report",
            path: "apps/e2e/playwright-report/",
            "retention-days": 7,
          },
        }),
        step({
          name: "Upload test traces",
          if: "failure()",
          uses: actionPins.uploadArtifact,
          with: {
            name: "preview-smoke-test-results",
            path: "apps/e2e/test-results/",
            "retention-days": 7,
          },
        }),
      ],
    },
    destroy: {
      if: closedAction,
      name: "Destroy PR preview",
      "runs-on": "ubuntu-latest",
      env: previewEnv(prStage),
      steps: [
        // Teardown needs the infra code and secrets, not the PR head (which
        // may already be deleted on close).
        checkout("Checkout", { ref: "dev" }),
        setupStep(),
        ...destroySteps(destroyStacks),
      ],
    },
  },
});

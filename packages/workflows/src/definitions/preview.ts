import { run, workflow } from "../builders";
import { checkout, setupStep } from "../catalog/actions";
import { deployChain, previewStacks, destroyStacks, destroySteps } from "../catalog/alchemy";
import {
  closedAction,
  notClosedAction,
  previewConcurrencyGroup,
  previewEnv,
  prStage,
} from "../catalog/preview";

/**
 * PR preview: deploy the full stack on every push to a PR, tear it down when
 * the PR closes.
 *
 * The comment is posted by the `preview` stack, which runs last in the chain
 * and owns a single consolidated comment for the whole stage.
 *
 * No e2e run here. Playwright drives the fixture simulator through
 * `pnpm test:e2e` against a local stack, which is why CI can prove the branch
 * works without a deployed stage. The preview exists for a human to click.
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
      "runs-on": "namespace-profile-yufugumi",
      env: previewEnv(prStage),
      steps: [
        // Full history so `git describe --tags` can stamp the release version
        // into the web build.
        checkout("Checkout", { "fetch-depth": 0 }),
        setupStep(),
        run("Deploy preview stage", deployChain(previewStacks)),
      ],
    },
    destroy: {
      if: closedAction,
      name: "Destroy PR preview",
      "runs-on": "namespace-profile-yufugumi",
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

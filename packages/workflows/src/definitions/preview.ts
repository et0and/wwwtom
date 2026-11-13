import { step, workflow } from "../builders";
import { checkout, setupStep } from "../catalog/actions";
import { deployChain, destroySteps, previewDestroyStacks, previewStacks } from "../catalog/alchemy";
import { nodeHeapEnv } from "../catalog/node";
import {
  closedAction,
  notClosedAction,
  previewConcurrencyGroup,
  previewEnv,
  previewFailureEnv,
  previewSuccessEnv,
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
  env: nodeHeapEnv(),
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
        step({
          name: "Deploy preview stage",
          run: deployChain(previewStacks),
          env: previewSuccessEnv,
        }),
        // A failed redeploy stops the chain before the comment stack runs, so
        // the previous success comment would survive untouched. Rewrite it
        // through the same stack and logical id: still one comment, now honest.
        step({
          name: "Mark preview comment failed",
          if: "failure()",
          run: "pnpm deploy:preview --yes",
          env: previewFailureEnv,
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
        ...destroySteps(previewDestroyStacks),
      ],
    },
  },
});

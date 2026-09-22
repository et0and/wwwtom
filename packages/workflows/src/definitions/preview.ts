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
 * the PR closes. Preview stacks post their own comment links through the
 * preview-comment resource.
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
      steps: [checkout(), setupStep(), run("Deploy preview stage", deployChain(previewStacks))],
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

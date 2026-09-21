import { run, workflow } from "../builders";
import { checkout, setupStep } from "../catalog/actions";
import {
  closedAction,
  notClosedAction,
  prStage,
  storybookPreviewConcurrencyGroup,
  storybookPreviewEnv,
} from "../catalog/preview";

/**
 * Storybook preview: build the static Storybook and upload it as Worker
 * assets on every push to a PR, tear the stage down when the PR closes.
 */
export const previewStorybook = workflow("preview-storybook", {
  name: "Storybook preview",
  on: {
    pull_request: {
      types: ["opened", "synchronize", "reopened", "closed"],
      branches: ["dev"],
    },
  },
  permissions: { contents: "read", issues: "write", "pull-requests": "write" },
  concurrency: {
    group: storybookPreviewConcurrencyGroup,
    "cancel-in-progress": true,
  },
  jobs: {
    deploy: {
      if: notClosedAction,
      name: "Deploy Storybook preview",
      "runs-on": "ubuntu-latest",
      env: storybookPreviewEnv(prStage),
      steps: [
        checkout(),
        setupStep(),
        run("Deploy Storybook preview stage", "pnpm deploy:storybook --yes"),
      ],
    },
    destroy: {
      if: closedAction,
      name: "Destroy Storybook preview",
      "runs-on": "ubuntu-latest",
      env: storybookPreviewEnv(prStage),
      steps: [
        // Teardown needs the infra code and secrets, not the PR head (which
        // may already be deleted on close).
        checkout("Checkout", { ref: "dev" }),
        setupStep(),
        run("Destroy Storybook preview stage", "pnpm destroy:storybook --yes"),
      ],
    },
  },
});

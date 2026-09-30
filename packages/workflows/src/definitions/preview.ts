import { run, step, workflow } from "../builders";
import { actionPins, checkout, setupStep } from "../catalog/actions";
import { deployChain, previewStacks, destroyStacks, destroySteps } from "../catalog/alchemy";
import {
  closedAction,
  notClosedAction,
  perfEnv,
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
      steps: [
        // Full history so `git describe --tags` can stamp the release version
        // into the web build.
        checkout("Checkout", { "fetch-depth": 0 }),
        setupStep(),
        run("Deploy preview stage", deployChain(previewStacks)),
      ],
    },
    perf: {
      if: notClosedAction,
      name: "Measure PR perf",
      needs: "deploy",
      "runs-on": "ubuntu-latest",
      // Probes take seconds; most of the budget is the analytics indexing wait
      // (up to 10 minutes, polled by the harness).
      "timeout-minutes": 20,
      env: perfEnv(prStage),
      steps: [
        checkout(),
        setupStep(),
        run("Measure candidate vs staging", "pnpm --filter @tom/infra perf:pr"),
        step({
          name: "Upload perf report",
          if: "always()",
          uses: actionPins.uploadArtifact,
          with: {
            name: "perf-report",
            path: "infra/perf-report.json",
            "retention-days": 14,
            "if-no-files-found": "ignore",
          },
        }),
        // Update one marker comment per PR instead of adding a new comment on
        // every synchronize. `gh` is preinstalled on GitHub-hosted runners.
        step({
          name: "Comment perf report",
          if: "always()",
          run: [
            "set -euo pipefail",
            'if [ ! -f infra/perf-report.md ]; then echo "No perf report to comment"; exit 0; fi',
            'marker="<!-- perf-report -->"',
            'comment_id=$(gh api "repos/$GITHUB_REPOSITORY/issues/$PULL_REQUEST/comments" --paginate --jq \'.[] | select((.body // "") | startswith("<!-- perf-report -->")) | .id\' | head -n1)',
            'body=$(printf \'%s\\n\\n%s\' "$marker" "$(cat infra/perf-report.md)")',
            'if [ -n "$comment_id" ]; then',
            '  gh api --method PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$comment_id" -f body="$body"',
            "else",
            '  gh api --method POST "repos/$GITHUB_REPOSITORY/issues/$PULL_REQUEST/comments" -f body="$body"',
            "fi",
          ],
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

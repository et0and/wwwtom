import { step, workflow } from "../builders";
import { actionPins, checkout, setupStep } from "../catalog/actions";
import { secret } from "../catalog/secrets";

/**
 * Sorts a PR's changed files by how much review attention each needs
 * (classifier.dev) and keeps one sticky comment updated. The first triage of
 * a PR is then addressed automatically by opencode; later pushes only refresh
 * the sticky comment, and re-runs come from the `/classifier` hook.
 *
 * Both jobs check out the base branch, not the PR merge commit, so a PR can
 * never swap the bot that runs with `pull-requests: write`. Fork PRs are
 * skipped: their token cannot comment.
 */
export const prReview = workflow("pr-review", {
  name: "PR review triage",
  on: {
    pull_request: {
      types: ["opened", "synchronize", "reopened", "ready_for_review"],
      branches: ["dev"],
    },
  },
  permissions: { contents: "read", "pull-requests": "write" },
  // One run per PR. Not cancel-in-progress: a push would otherwise kill the
  // agent mid-review, and the replacement run never re-enters the address job.
  concurrency: {
    group: "pr-review-${{ github.event.pull_request.number }}",
    "cancel-in-progress": false,
  },
  jobs: {
    triage: {
      name: "Triage changed files",
      "runs-on": "ubuntu-latest",
      if: "github.event.pull_request.draft == false && github.event.pull_request.head.repo.fork == false",
      steps: [
        // The triage script is taken from the base branch, never the PR head.
        checkout("Checkout base branch", {
          ref: "${{ github.event.pull_request.base.sha }}",
          "persist-credentials": false,
        }),
        setupStep({ install: "false" }),
        step({
          name: "Classify changed files and upsert the sticky comment",
          env: { GH_TOKEN: "${{ github.token }}" },
          run: [
            "# On the PR that introduces this workflow the base branch has no",
            "# script yet; skip until it lands there.",
            "if [ ! -f scripts/pr-review.ts ]; then",
            '  echo "scripts/pr-review.ts not on the base branch yet; skipping."',
            "  exit 0",
            "fi",
            "node scripts/pr-review.ts \\",
            '  --repo="${{ github.repository }}" \\',
            "  --pr=${{ github.event.pull_request.number }}",
          ],
        }),
      ],
    },
    address: {
      name: "Address the triage",
      needs: "triage",
      // Only the PR's first triage, and only when et0and pushed: the opencode
      // action asserts the triggering actor's write permission, so the
      // agent's own commits and bot PRs must not re-enter here.
      if: "(github.event.action == 'opened' || github.event.action == 'ready_for_review') && github.actor == 'et0and'",
      "runs-on": "ubuntu-latest",
      permissions: {
        "id-token": "write",
        contents: "write",
        "pull-requests": "write",
      },
      steps: [
        // The opencode action fetches and checks out the PR branch itself.
        checkout("Checkout base branch", {
          ref: "${{ github.event.pull_request.base.sha }}",
          "persist-credentials": false,
        }),
        step({
          name: "Address the triage",
          uses: actionPins.opencode,
          env: { OPENCODE_API_KEY: secret("OPENCODE_API_KEY") },
          with: {
            model: "opencode-go/muse-spark-1.3-contributor",
            prompt: [
              "Respond to the classifier.dev review triage on this pull request.",
              "",
              "The sticky comment whose first line is",
              "`<!-- classifier-pr-review -->`, posted by this workflow, groups",
              "the changed files by review attention. Work through the files it",
              'lists under "needs careful review".',
              "",
              "For each flagged file:",
              "1. Read the file and the part of the diff that touches it.",
              "2. Review it for real defects and repo-standard violations",
              "   (AGENTS.md, plus the nearest AGENTS.md in its directory).",
              "3. Fix genuine issues with the smallest correct change. When a",
              "   flag is already handled, is not a real issue, or needs a",
              "   human call, leave the code alone and say why.",
              "",
              "Do not touch unrelated code, do not merge, and do not edit",
              ".github/workflows/ or .github/actions/.",
              "",
              "Verify before pushing: `pnpm turbo run typecheck`,",
              "`pnpm turbo run test`, `pnpm turbo run lint`, `pnpm format`.",
              "",
              "Then commit (conventional commits), push to this PR's branch, and",
              "keep the response short: what you fixed, what you checked and",
              "left alone, and the verification results. If the sticky triage",
              "comment is missing, say so in one line and stop.",
            ],
          },
        }),
      ],
    },
  },
});

import { step, workflow } from "../builders";
import { actionPins, checkout } from "../catalog/actions";
import { secret } from "../catalog/secrets";

/**
 * Review-response hook: when et0and replies `/classifier` to the sticky
 * classifier.dev triage, opencode reads that triage, reviews the flagged
 * files, fixes what is genuinely wrong, and replies on the PR. The shared
 * oc-gate composite decides the trigger.
 */
export const classifierReview = workflow("classifier-review", {
  name: "Address classifier triage",
  on: {
    issue_comment: { types: ["created"] },
    pull_request_review_comment: { types: ["created"] },
  },
  permissions: {
    "id-token": "write",
    contents: "write",
    "pull-requests": "write",
    issues: "write",
  },
  // One agent run per PR. Not cancel-in-progress: every comment starts a run
  // (the gate then rejects non-triggers), so cancelling would let an
  // unrelated comment kill a running agent.
  concurrency: {
    group: "classifier-review-${{ github.event.issue.number || github.event.pull_request.number }}",
    "cancel-in-progress": false,
  },
  jobs: {
    respond: {
      "runs-on": "ubuntu-latest",
      steps: [
        checkout("Checkout repository", { "persist-credentials": false }),
        step({
          name: "Classifier gate",
          id: "gate",
          uses: "./.github/actions/oc-gate",
          with: { "allowed-users": "et0and", triggers: "/classifier" },
        }),
        step({
          name: "Resolve the pull request number",
          id: "pr",
          if: "steps.gate.outputs.triggered == 'true'",
          run: [
            'if [[ "${{ github.event_name }}" == "pull_request_review_comment" ]]; then',
            '  echo "number=${{ github.event.pull_request.number }}" >> "$GITHUB_OUTPUT"',
            "elif jq -e '.issue.pull_request' \"$GITHUB_EVENT_PATH\" > /dev/null; then",
            '  echo "number=${{ github.event.issue.number }}" >> "$GITHUB_OUTPUT"',
            "fi",
          ],
        }),
        step({
          name: "Address the triage",
          if: "steps.pr.outputs.number != ''",
          uses: actionPins.opencode,
          env: { OPENCODE_API_KEY: secret("OPENCODE_API_KEY") },
          with: {
            model: "opencode-go/muse-spark-1.3-contributor",
            mentions: "/classifier",
            prompt: [
              "Respond to the classifier.dev review triage on pull request",
              "#${{ steps.pr.outputs.number }}. Triggered by",
              "@${{ github.event.comment.user.login }}, who wrote:",
              "${{ github.event.comment.body }}",
              "",
              "The PR carries one sticky comment whose first line is",
              "`<!-- classifier-pr-review -->` (posted by",
              ".github/workflows/pr-review.yml). Read it, then work through the",
              'files it groups under "needs careful review".',
              "",
              "For each flagged file:",
              "1. Read the file and the part of the PR diff that touches it.",
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
              "Then commit (conventional commits), push to this PR's branch,",
              "and post exactly one comment on the PR: what you fixed, what you",
              "checked and left alone, and the verification results. If the",
              "sticky triage comment is missing, post one line saying so and",
              "stop.",
            ],
          },
        }),
      ],
    },
  },
});

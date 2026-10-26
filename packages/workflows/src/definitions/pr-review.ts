import { step, workflow } from "../builders";
import { actionPins, checkout, setupStep } from "../catalog/actions";
import { secret } from "../catalog/secrets";

/**
 * PR triage, done by an agent instead of classifier.dev.
 *
 * classifier.dev only sorted the changed files by how much attention they
 * needed, and a sticky comment carried that verdict to a second job that ran
 * opencode over the flagged files. That handshake is what this replaces: one
 * agent reads the diff, decides what matters itself, and posts a single
 * review comment. The model is a cheap flash lane at low reasoning effort —
 * this is triage, not a substitute for a human review.
 *
 * Comment only: the agent does not edit, push, approve or merge.
 *
 * The job checks out the base branch first, so the setup action always comes
 * from the base. The triage action then checks out the PR head to read the
 * change, so PR-controlled files are present while the agent runs, and it
 * posts its review with a token that can write comments. Fork PRs and drafts
 * are skipped.
 */
export const prReview = workflow("pr-review", {
  name: "PR triage",
  on: {
    pull_request: {
      types: ["opened", "synchronize", "reopened", "ready_for_review"],
      branches: ["dev"],
    },
  },
  permissions: {
    "id-token": "write",
    contents: "read",
    "pull-requests": "write",
    issues: "write",
  },
  // One review per PR, and a new push supersedes the review of the old head:
  // the job only comments, so there is no work to lose by cancelling.
  concurrency: {
    group: "pr-triage-${{ github.event.pull_request.number }}",
    "cancel-in-progress": true,
  },
  jobs: {
    triage: {
      name: "Triage the diff",
      "runs-on": "namespace-profile-yufugumi",
      // A cheap triage pass has no reason to run for hours, and the agent can
      // loop on a difficult diff. GitHub's six-hour default is not a cap.
      "timeout-minutes": 30,
      if: "github.event.pull_request.draft == false && github.event.pull_request.head.repo.fork == false",
      steps: [
        checkout("Checkout base branch", {
          ref: "${{ github.event.pull_request.base.sha }}",
          // The merge base is compared against the PR head below; a shallow
          // base leaves it unreachable.
          "fetch-depth": 0,
          "persist-credentials": false,
        }),
        // The triage action fetches the PR head with a shallow boundary, so
        // three-dot diffing inside the agent can fail on long branches. Resolve
        // the merge base while the full history is still here and hand the
        // agent that commit instead: `git diff <merge-base> HEAD` compares the
        // same two trees without walking history again.
        step({
          name: "Find the merge base",
          run: [
            "merge_base=$(git merge-base ${{ github.event.pull_request.base.sha }} ${{ github.event.pull_request.head.sha }})",
            'echo "PR_MERGE_BASE=$merge_base" >> "$GITHUB_ENV"',
          ],
        }),
        // The runner's default Node is older than the pnpm this repo pins, so
        // the agent's own tooling needs Node 24 and pnpm on the job PATH. It
        // installs dependencies itself; nothing here needs them.
        setupStep({ install: "false" }),
        // Headless CI has no one to answer a permission prompt. Anything that
        // reaches outside the checkout (gh's own config, /tmp caches) must fail
        // immediately instead of stalling until the job timeout.
        step({
          name: "Triage",
          uses: actionPins.opencode,
          env: {
            OPENCODE_API_KEY: secret("OPENCODE_API_KEY"),
            HUSKY: "0",
            OPENCODE_CONFIG_CONTENT: '{"permission":{"external_directory":"deny"}}',
          },
          with: {
            model: "opencode-go/deepseek-v4.1-flash",
            // Low reasoning effort: a cheap read of the diff, not a deep audit.
            variant: "low",
            prompt: [
              "Triage pull request #${{ github.event.pull_request.number }}",
              "against its base branch. The PR head is checked out; see the",
              "change with `git diff ${{ env.PR_MERGE_BASE }} HEAD`, and read",
              "the files it touches for the parts that matter. Do not use `gh`",
              "or the network, and stay inside the checkout — external",
              "directory access is denied.",
              "",
              "Report only what is genuinely wrong: real defects, and",
              "violations of AGENTS.md or the nearest AGENTS.md in a",
              "directory. Skip style nits, anything a formatter or linter",
              "already catches, and anything already correct.",
              "",
              "End with the review comment: the findings that matter, most",
              "important first, each with the file and the reason. Say plainly",
              "when a change is fine. If you find nothing, say so in one line.",
              "The action posts your final response as the single comment.",
              "",
              "Do not edit files, do not push, do not approve, and do not",
              "merge — this run must not change the branch it reviews.",
            ],
          },
        }),
      ],
    },
  },
});

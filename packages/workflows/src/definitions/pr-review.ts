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
 * Comment only. It does not edit, push, approve or merge, so a run can never
 * change the branch it is reviewing.
 *
 * Both the gate and the checkout are the base branch, never the PR head, so a
 * PR cannot swap the code that runs with `pull-requests: write`. Fork PRs and
 * drafts are skipped.
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
      if: "github.event.pull_request.draft == false && github.event.pull_request.head.repo.fork == false",
      steps: [
        checkout("Checkout base branch", {
          ref: "${{ github.event.pull_request.base.sha }}",
          "persist-credentials": false,
        }),
        // The runner's default Node is older than the pnpm this repo pins, so
        // the agent's own tooling needs Node 24 and pnpm on the job PATH. It
        // installs dependencies itself; nothing here needs them.
        setupStep({ install: "false" }),
        step({
          name: "Triage",
          uses: actionPins.opencode,
          env: { OPENCODE_API_KEY: secret("OPENCODE_API_KEY"), HUSKY: "0" },
          with: {
            model: "opencode-go/deepseek-v4.1-flash",
            // Low reasoning effort: a cheap read of the diff, not a deep audit.
            variant: "low",
            prompt: [
              "Triage pull request #${{ github.event.pull_request.number }}",
              "against its base branch. `gh pr diff` has the change; read the",
              "files it touches for the parts that matter.",
              "",
              "Report only what is genuinely wrong: real defects, and",
              "violations of AGENTS.md or the nearest AGENTS.md in a",
              "directory. Skip style nits, anything a formatter or linter",
              "already catches, and anything already correct.",
              "",
              "Post exactly one comment on the PR: the findings that matter,",
              "most important first, each with the file and the reason. Say",
              "plainly when a change is fine. If you find nothing, post one",
              "line saying so.",
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

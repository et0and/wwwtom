import { step, workflow } from "../builders";
import { actionPins, checkout } from "../catalog/actions";
import { secret } from "../catalog/secrets";

/**
 * The trigger and author check lives in the shared oc-gate composite: the job
 * runs on every comment and gates its real steps on the `triggered` output.
 */
export const opencode = workflow("opencode", {
  name: "opencode",
  on: {
    issue_comment: { types: ["created"] },
    pull_request_review_comment: { types: ["created"] },
  },
  jobs: {
    opencode: {
      "runs-on": "ubuntu-latest",
      permissions: {
        "id-token": "write",
        contents: "read",
        "pull-requests": "write",
        issues: "write",
      },
      steps: [
        checkout("Checkout repository", { "persist-credentials": false }),
        step({
          name: "OpenCode gate",
          id: "oc",
          uses: "./.github/actions/oc-gate",
          with: { "allowed-users": "et0and" },
        }),
        step({
          name: "Run opencode",
          if: "steps.oc.outputs.triggered == 'true'",
          uses: actionPins.opencode,
          env: { OPENCODE_API_KEY: secret("OPENCODE_API_KEY") },
          with: { model: "deepseek/deepseek-v4-flash-0731" },
        }),
      ],
    },
  },
});

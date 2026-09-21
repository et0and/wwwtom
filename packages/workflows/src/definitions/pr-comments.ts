import { step, workflow } from "../builders";
import { actionPins, checkout } from "../catalog/actions";
import { secret } from "../catalog/secrets";

/**
 * Any author may trigger this workflow as long as the PR carries the
 * `opencode` label; the oc-gate composite enforces both the label and the
 * trigger phrase.
 */
export const prComments = workflow("pr-comments", {
  name: "Respond to PR Comments",
  on: {
    issue_comment: { types: ["created"] },
    pull_request_review_comment: { types: ["created"] },
  },
  jobs: {
    respond: {
      "runs-on": "ubuntu-latest",
      permissions: {
        "id-token": "write",
        contents: "write",
        "pull-requests": "write",
        issues: "write",
      },
      steps: [
        checkout("Checkout repository", { "persist-credentials": false }),
        step({
          name: "OpenCode gate",
          id: "oc",
          uses: "./.github/actions/oc-gate",
          with: { "allowed-users": "", "require-label": "true" },
        }),
        step({
          name: "Get PR info",
          id: "pr",
          if: "steps.oc.outputs.triggered == 'true'",
          run: [
            'if [[ "${{ github.event_name }}" == "pull_request_review_comment" ]]; then',
            '  echo "pr_number=${{ github.event.pull_request.number }}" >> $GITHUB_OUTPUT',
            "else",
            '  echo "pr_number=${{ github.event.issue.number }}" >> $GITHUB_OUTPUT',
            "fi",
          ],
        }),
        step({
          name: "Run opencode with thread context",
          if: "steps.oc.outputs.triggered == 'true'",
          uses: actionPins.opencode,
          env: { OPENCODE_API_KEY: secret("OPENCODE_API_KEY") },
          with: {
            model: "deepseek/deepseek-v4-flash-0731",
            prompt: [
              "Respond to this comment on PR #${{ steps.pr.outputs.pr_number }}.",
              "",
              "Comment from @${{ github.event.comment.user.login }}:",
              "> ${{ github.event.comment.body }}",
              "",
              'The PR was created by the "Create PR from Prompt" workflow. Please:',
              "1. Review the context of the discussion",
              "2. Make any requested changes if appropriate",
              "3. Respond clearly to the comment",
              "",
              "When making changes:",
              "- Commit with a clear message referencing the comment",
              "- Push to the existing branch",
              "- Only modify files relevant to the request",
            ],
          },
        }),
        step({
          name: "Reply with summary",
          if: "always() && steps.oc.outputs.triggered == 'true'",
          env: { GH_TOKEN: "${{ github.token }}" },
          run: [
            'if [[ "${{ job.status }}" == "success" ]]; then',
            '  gh pr comment ${{ steps.pr.outputs.pr_number }} --body "✅ I\'ve processed your request. Check the latest commits for changes."',
            "else",
            '  gh pr comment ${{ steps.pr.outputs.pr_number }} --body "❌ Something went wrong while processing your request. Please check the workflow logs."',
            "fi",
          ],
        }),
      ],
    },
  },
});

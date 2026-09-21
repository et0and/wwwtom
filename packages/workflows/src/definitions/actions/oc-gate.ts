import { compositeAction, step } from "../../builders";

/**
 * Decide whether a comment should invoke an agent workflow. A composite step
 * cannot appear in `jobs.<id>.if:`, so the job runs unconditionally and every
 * step that needs the go/no-go reads `steps.<id>.outputs.triggered`.
 */
export const ocGate = compositeAction("oc-gate", {
  name: "OpenCode gate",
  description:
    "Decide whether a comment should invoke an agent workflow. A composite step cannot appear in `jobs.<id>.if:`, so the job runs unconditionally and every step that needs the go/no-go reads `steps.<id>.outputs.triggered`. The gate itself is a tiny bash check — no checkout required.",
  inputs: {
    "allowed-users": {
      description:
        "Comma-separated login(s) allowed to trigger. Empty means anyone who wrote a trigger comment may invoke the agent.",
      default: "et0and",
    },
    "require-label": {
      description: "Require the PR/issue to carry the `opencode` label.",
      default: "false",
    },
    triggers: {
      description:
        "Comma-separated trigger prefixes. A comment triggers when it starts with one, or contains it after a space (the original /oc and /opencode expressions). Workflows for other agents pass their own phrase.",
      default: "/oc,/opencode",
    },
  },
  outputs: {
    triggered: {
      description: "true when the comment is an authorized trigger.",
      value: "${{ steps.check.outputs.triggered }}",
    },
  },
  runs: {
    using: "composite",
    steps: [
      step({
        name: "Evaluate trigger",
        id: "check",
        shell: "bash",
        env: {
          BODY: "${{ github.event.comment.body }}",
          AUTHOR: "${{ github.event.comment.user.login }}",
          ALLOWED: "${{ inputs.allowed-users }}",
          LABELS:
            "${{ join(github.event.pull_request.labels.*.name, ',') }}, ${{ join(github.event.issue.labels.*.name, ',') }}",
          REQUIRE_LABEL: "${{ inputs.require-label }}",
          TRIGGERS: "${{ inputs.triggers }}",
        },
        run: [
          "# Trigger check mirrors the original expressions per phrase: an",
          "# explicit leading phrase, or the phrase after a space anywhere.",
          'triggered="false"',
          "IFS=',' read -r -a triggers <<< \"$TRIGGERS\"",
          'for trigger in "${triggers[@]}"; do',
          '  [[ -z "$trigger" ]] && continue',
          '  case "$BODY" in',
          '    "$trigger"* | *" $trigger"*)',
          '      triggered="true"',
          "      break",
          "      ;;",
          "  esac",
          "done",
          "",
          "# Label gate: only PR-comments-style workflows opt in.",
          'if [[ "$triggered" == "true" && "$REQUIRE_LABEL" == "true" ]]; then',
          '  if [[ ",$LABELS," != *",opencode,"* ]]; then',
          '    triggered="false"',
          "  fi",
          "fi",
          "",
          "# Author gate: empty means anyone; otherwise a comma-separated list.",
          'if [[ "$triggered" == "true" && -n "$ALLOWED" ]]; then',
          '  case ",$ALLOWED," in',
          '    *",$AUTHOR,"*) ;;',
          '    *) triggered="false" ;;',
          "  esac",
          "fi",
          "",
          'echo "triggered=$triggered" >> "$GITHUB_OUTPUT"',
        ],
      }),
    ],
  },
});

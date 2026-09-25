import { run, workflow } from "../builders";
import { checkout, setupStep } from "../catalog/actions";
import { secret } from "../catalog/secrets";
import { ex } from "../expressions";

/**
 * Closed PRs do not reliably dispatch the preview workflow's destroy job
 * (merges do; plain closes often produce no run at all), so this nightly
 * sweep is the backstop: destroy the preview stages of recently closed PRs.
 * Destroying an already-gone stage is a no-op, and each stack runs even when
 * the previous one fails.
 */
export const previewSweep = workflow("preview-sweep", {
  name: "Sweep orphan PR previews",
  on: {
    schedule: [{ cron: "41 3 * * *" }],
    workflow_dispatch: null,
  },
  permissions: { contents: "read", "pull-requests": "read" },
  concurrency: { group: "preview-sweep", "cancel-in-progress": false },
  jobs: {
    sweep: {
      name: "Destroy previews of closed PRs",
      "runs-on": "ubuntu-latest",
      env: {
        CLOUDFLARE_ACCOUNT_ID: secret("CLOUDFLARE_DEFAULT_ACCOUNT_ID"),
        CLOUDFLARE_API_TOKEN: secret("CLOUDFLARE_API_TOKEN"),
        TOM_SECRETS: secret("TOM_SECRETS"),
        AXIOM_TOKEN: secret("AXIOM_TOKEN"),
        ALCHEMY_ENV_FILE: "/dev/null",
        GITHUB_TOKEN: ex("github.token"),
        GH_TOKEN: ex("github.token"),
      },
      steps: [
        checkout(),
        setupStep(),
        run("Destroy preview stages of recently closed PRs", [
          "cutoff=$(date -u -d '14 days ago' +%Y-%m-%dT%H:%M:%SZ)",
          "prs=$(gh pr list --state closed --limit 100 --json number,closedAt \\",
          `  | jq -r --arg cutoff "$cutoff" '.[] | select(.closedAt > $cutoff) | .number')`,
          'if [ -z "$prs" ]; then',
          '  echo "No recently closed PRs; nothing to sweep."',
          "  exit 0",
          "fi",
          "for pr in $prs; do",
          '  echo "Sweeping preview stage pr-$pr"',
          '  export ALCHEMY_STAGE="pr-$pr" PULL_REQUEST="$pr"',
          "  pnpm destroy:storybook --yes || true",
          "  pnpm destroy:web --yes || true",
          "  pnpm destroy:crm --yes || true",
          "  pnpm destroy:editor --yes || true",
          "  pnpm destroy:sophie --yes || true",
          "  pnpm destroy:adapter --yes || true",
          "  pnpm destroy:api --yes || true",
          "  pnpm destroy:shared --yes || true",
          "done",
        ]),
      ],
    },
  },
});

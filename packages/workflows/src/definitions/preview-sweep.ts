import { run, workflow } from "../builders";
import { checkout, setupStep } from "../catalog/actions";
import { sweepDestroyStacks } from "../catalog/alchemy";
import { nodeHeapEnv } from "../catalog/node";
import { secret } from "../catalog/secrets";
import { ex } from "../expressions";

/**
 * Closed PRs do not reliably dispatch the preview workflow's destroy job
 * (merges do; plain closes often produce no run at all), so this nightly
 * sweep is the backstop: destroy the preview stages of recently closed PRs.
 * Destroying an already-gone stage is a no-op, and each stack runs even when
 * the previous one fails.
 *
 * The consolidated preview stack owns a comment-only state row, so its
 * destroy plan has nothing to tear down on GitHub; drop the row instead.
 * Stages created before the consolidated comment moved to `preview.run.ts`
 * still have a `GitHub.Comment` row in the web or sophie state. Those stacks
 * no longer register the provider, so their destroy plan aborts before
 * deleting the Worker, and the surviving Worker then blocks the shared queue
 * deletion. Drop the state rows first; the comments live on closed PRs, so
 * forgetting the state entry is enough.
 *
 * The lookback is wider than one night on purpose: a destroy that fails must
 * be retried, and a stage that falls out of the window is never swept again.
 */
export const previewSweep = workflow("preview-sweep", {
  name: "Sweep orphan PR previews",
  on: {
    schedule: [{ cron: "41 3 * * *" }],
    workflow_dispatch: null,
  },
  permissions: { contents: "read", "pull-requests": "read" },
  concurrency: { group: "preview-sweep", "cancel-in-progress": false },
  env: nodeHeapEnv(),
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
          "cutoff=$(date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%SZ)",
          "prs=$(gh pr list --state closed --limit 100 --json number,closedAt \\",
          `  | jq -r --arg cutoff "$cutoff" '.[] | select(.closedAt > $cutoff) | .number')`,
          'if [ -z "$prs" ]; then',
          '  echo "No recently closed PRs; nothing to sweep."',
          "  exit 0",
          "fi",
          "for pr in $prs; do",
          '  echo "Sweeping preview stage pr-$pr"',
          '  export ALCHEMY_STAGE="pr-$pr" PULL_REQUEST="$pr"',
          '  for row in "wwwtom-preview/pr-$pr/wwwtom-preview" "wwwtom-web/pr-$pr/preview-comment" "sophie/pr-$pr/sophie-cms-preview" "sophie/pr-$pr/sophie-web-preview"; do',
          '    pnpm --filter @tom/infra exec alchemy state list --backend cloudflare "$row" >/dev/null 2>&1 &&',
          '      pnpm --filter @tom/infra exec alchemy state delete --backend cloudflare "$row" || true',
          "  done",
          ...sweepDestroyStacks.map((stack) => `  pnpm destroy:${stack} --yes || true`),
          "done",
        ]),
      ],
    },
  },
});

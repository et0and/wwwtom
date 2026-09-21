import { compositeAction, step } from "../../builders";
import { actionPins } from "../../catalog/actions";

/**
 * Shared setup block for every workflow. One definition keeps Node, pnpm, the
 * store cache, and the optional Playwright install from drifting between
 * workflows.
 */
export const setup = compositeAction("setup", {
  name: "Setup repository",
  description:
    "Provision Node 24, pin pnpm, restore the pnpm store cache, and install dependencies with --frozen-lockfile. One definition for every workflow so the setup block never drifts. Call after an explicit `actions/checkout` (local composite actions require the workspace to exist first).",
  inputs: {
    install: {
      description: "Run `pnpm install --frozen-lockfile` after setup.",
      default: "true",
    },
    "install-playwright": {
      description:
        "Also cache (~/.cache/ms-playwright) and install the Playwright chromium browser (e2e-only workflows).",
      default: "false",
    },
  },
  runs: {
    using: "composite",
    steps: [
      step({ uses: actionPins.setupNode, with: { "node-version": 24 } }),
      step({ uses: actionPins.pnpmSetup }),
      // The pnpm store is content-addressed and shared across every job on
      // this runner type, so one warm store makes each parallel job's
      // `pnpm install` a near-instant restore.
      step({
        name: "Resolve the pnpm store path",
        shell: "bash",
        run: `echo "PNPM_STORE_PATH=$(pnpm store path)" >> "$GITHUB_ENV"`,
      }),
      // The lockfile is the single source of truth for the dependency graph:
      // any change invalidates the whole store cache.
      step({
        name: "Restore the pnpm store",
        uses: actionPins.cache,
        with: {
          path: "${{ env.PNPM_STORE_PATH }}",
          key: "${{ runner.os }}-pnpm-store-${{ hashFiles('pnpm-lock.yaml') }}",
          "restore-keys": "${{ runner.os }}-pnpm-store-",
        },
      }),
      step({
        name: "Install dependencies",
        if: "${{ inputs.install == 'true' }}",
        shell: "bash",
        run: "pnpm install --frozen-lockfile",
      }),
      // The lockfile pins the playwright version, which pins the browser
      // revisions — any lockfile change just reinstalls.
      step({
        name: "Cache Playwright browsers",
        if: "${{ inputs.install-playwright == 'true' }}",
        uses: actionPins.cache,
        with: {
          path: "~/.cache/ms-playwright",
          key: "${{ runner.os }}-ms-playwright-${{ hashFiles('pnpm-lock.yaml') }}",
        },
      }),
      step({
        name: "Install Playwright browsers",
        if: "${{ inputs.install-playwright == 'true' }}",
        shell: "bash",
        run: "pnpm --filter @tom/e2e exec playwright install --with-deps chromium",
      }),
    ],
  },
});

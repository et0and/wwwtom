import { ex } from "../expressions";
import type { Env, Expression, RunStep } from "../model";
import { secret } from "./secrets";

/**
 * The stage a deploy run targets: manual dispatches take the `stage` input,
 * pushes to dev deploy the staging stage. Production is a manual dispatch
 * with its own environment approval gate.
 */
export const stageExpression: Expression = ex(
  "github.event_name == 'push' && 'staging' || inputs.stage",
);

export const stageLabel = `Deploy ${stageExpression}`;

export const stageConcurrencyGroup = `deploy-${stageExpression}`;

/**
 * The application pipeline, in dependency order: later stacks depend on
 * earlier ones.
 */
const appStacks = ["shared", "api", "adapter", "web", "sophie"] as const;

/**
 * Zone-level stacks. They own resources shared by every stage (WAF rules live
 * on the zone itself, not on a Worker), so they must deploy exactly once —
 * from production — and never from a PR preview, where concurrent runs would
 * fight over the same ruleset.
 */
const zoneStacks = ["edge"] as const;

/**
 * Alchemy stacks a staging or production deploy provisions: the application
 * pipeline plus the static Storybook site.
 */
export const deployStacks = [...appStacks, "storybook"] as const;

/**
 * Zone-level stacks, deployed on their own so they can be gated to the
 * production stage.
 */
export const edgeStacks = zoneStacks;

/**
 * Alchemy stacks a PR preview provisions. The `preview` stack owns the
 * consolidated PR comment and runs last, so its links are live when it posts.
 * Storybook has its own preview workflow, so it is left out here to keep two
 * runs off one stage. Zone-level stacks are left out too: they are shared by
 * every stage and would collide across concurrent previews.
 */
export const previewStacks = [...appStacks, "preview"] as const;

export type DeployStack = (typeof deployStacks)[number];
export type PreviewStack = (typeof previewStacks)[number];
export type EdgeStack = (typeof edgeStacks)[number];

/**
 * Chain the per-stack Alchemy deploy scripts. Later stacks depend on earlier
 * ones, so each command runs only when its predecessor succeeds.
 */
export const deployChain = (
  stacks: ReadonlyArray<DeployStack | PreviewStack | EdgeStack>,
): string => stacks.map((stack) => `pnpm deploy:${stack} --yes`).join(" &&\n");

/**
 * Teardown order: the reverse of the deploy stack order.
 */
export const destroyStacks = ["web", "editor", "sophie", "adapter", "api", "shared"] as const;

export type DestroyStack = (typeof destroyStacks)[number];

/**
 * One step per stack, every step after the first marked `if: always()` so a
 * failed teardown never blocks the rest — a single `&&` chain would orphan
 * workers when an earlier destroy fails.
 */
export const destroySteps = (stacks: ReadonlyArray<DestroyStack>): ReadonlyArray<RunStep> =>
  stacks.map((stack, index) =>
    index === 0
      ? { name: `Destroy ${stack} preview stage`, run: `pnpm destroy:${stack} --yes` }
      : {
          name: `Destroy ${stack} preview stage`,
          if: "always()",
          run: `pnpm destroy:${stack} --yes`,
        },
  );

/**
 * Cloudflare and secrets-store credentials for Alchemy deploys. The stage is
 * the workflow's stage expression; ALCHEMY_ENV_FILE=/dev/null stops Alchemy
 * from reading a developer's .dev.vars in CI.
 */
export const alchemyEnv = (stage: Expression): Env => ({
  ALCHEMY_STAGE: stage,
  CLOUDFLARE_ACCOUNT_ID: secret("CLOUDFLARE_DEFAULT_ACCOUNT_ID"),
  ALCHEMY_ENV_FILE: "/dev/null",
});

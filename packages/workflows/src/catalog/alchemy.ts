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
 * Alchemy stacks a staging or production deploy provisions: the application
 * pipeline plus the static Storybook site.
 */
export const deployStacks = [...appStacks, "storybook"] as const;

/**
 * Alchemy stacks a PR preview provisions. Storybook has its own preview
 * workflow, so it is left out here to keep two runs off one stage.
 */
export const previewStacks = appStacks;

export type DeployStack = (typeof deployStacks)[number];

/**
 * Chain the per-stack Alchemy deploy scripts. Later stacks depend on earlier
 * ones, so each command runs only when its predecessor succeeds.
 */
export const deployChain = (stacks: ReadonlyArray<DeployStack>): string =>
  stacks.map((stack) => `pnpm deploy:${stack} --yes`).join(" &&\n");

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
  CLOUDFLARE_API_TOKEN: secret("CLOUDFLARE_API_TOKEN"),
  TOM_SECRETS: secret("TOM_SECRETS"),
  AXIOM_TOKEN: secret("AXIOM_TOKEN"),
  ALCHEMY_ENV_FILE: "/dev/null",
});

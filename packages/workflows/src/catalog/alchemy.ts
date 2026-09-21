import { ex } from "../expressions";
import type { Env, Expression } from "../model";
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
 * Alchemy stacks the deploy pipeline provisions, in dependency order: later
 * stacks depend on earlier ones.
 */
export const deployStacks = ["shared", "api", "adapter", "web", "editor", "sophie"] as const;

export type DeployStack = (typeof deployStacks)[number];

/**
 * Chain the per-stack Alchemy deploy scripts. Later stacks depend on earlier
 * ones, so each command runs only when its predecessor succeeds.
 */
export const deployChain = (stacks: ReadonlyArray<DeployStack>): string =>
  stacks.map((stack) => `pnpm deploy:${stack} --yes`).join(" &&\n");

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

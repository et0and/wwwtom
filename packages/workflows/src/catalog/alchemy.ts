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
 * The stage pipeline, in dependency order: later stacks depend on earlier
 * ones. `turbo` is the shared Turborepo remote cache; it reads the shared
 * secret bundle but no application stack depends on it, so it stays directly
 * after `shared`. `api` precedes `adapter` because the adapter binds the api
 * Worker as a service.
 */
const pipelineStacks = ["shared", "turbo", "api", "adapter", "web", "sophie"] as const;

/**
 * Static Storybook site. A full stage ships it; PR previews leave it to
 * `preview-storybook.yml`, so two runs never share one stage.
 */
const storybookStacks = ["storybook"] as const;

/**
 * Zone-level stacks. They own resources shared by every stage (WAF rules live
 * on the zone itself, not on a Worker), so they must deploy exactly once —
 * from production — and never from a PR preview, where concurrent runs would
 * fight over the same ruleset.
 */
const zoneStacks = ["edge"] as const;

/**
 * On-demand stacks. `runner` starts from a control request, not a deploy
 * chain, and nothing in the pipeline depends on it.
 */
const onDemandStacks = ["runner"] as const;

/**
 * Stacks that never run in an automatic stage chain. Every one has an
 * explicit `deploy:<stack>` root script; none may leak into `deploy` or
 * `preview`.
 */
export const auxiliaryStacks = [...zoneStacks, ...onDemandStacks] as const;

/**
 * A staging or production deploy provisions the full stage pipeline followed
 * by the static Storybook site.
 */
export const deployStacks = [...pipelineStacks, ...storybookStacks] as const;

/**
 * Zone-level stacks, deployed on their own so they can be gated to the
 * production stage.
 */
export const edgeStacks = zoneStacks;

/**
 * A PR preview provisions the stage pipeline without the turbo remote cache
 * (CI uses the production cache, not a per-PR one) and finishes with the
 * consolidated comment stack, so every link is live when it posts.
 */
export const previewStacks = [
  ...pipelineStacks.filter((stack) => stack !== "turbo"),
  "preview",
] as const;

/**
 * Stacks with no deploy command that still belong in teardown. Tom's editor
 * is retired, but an existing stage can own its old Worker and domain.
 */
const destroyOnlyStacks = ["editor"] as const;

export type DeployStack = (typeof deployStacks)[number];
export type PreviewStack = (typeof previewStacks)[number];
export type EdgeStack = (typeof edgeStacks)[number];
export type AuxiliaryStack = (typeof auxiliaryStacks)[number];
export type DestroyStack = DeployStack | PreviewStack | (typeof destroyOnlyStacks)[number];

/**
 * Chain the per-stack Alchemy deploy scripts. Later stacks depend on earlier
 * ones, so each command runs only when its predecessor succeeds.
 */
export const deployChain = (
  stacks: ReadonlyArray<DeployStack | PreviewStack | EdgeStack>,
): string => stacks.map((stack) => `pnpm deploy:${stack} --yes`).join(" &&\n");

/**
 * Teardown order: reverse dependency order. The retired Tom editor is
 * destroy-only (`deploy:editor` no longer exists), so it is inserted directly
 * after `web`, the last stack whose adapter origin it was built against.
 */

/**
 * Teardown of a full stage. `preview` is not part of this chain: it owns only
 * the consolidated GitHub comment and no Cloudflare resource, and a regular
 * stage never deploys it.
 */
/**
 * Teardown of a full stage. Deploying the adapter before the API lets it unbind
 * a queue before the API deletes it, so the order is not the reverse of deploy.
 */
export const destroyStacks = [
  "storybook",
  "sophie",
  "web",
  "editor",
  "adapter",
  "api",
  "turbo",
  "shared",
] as const;

/**
 * Teardown of a PR preview stage. The comment stack is left out of the
 * destroy chain: comments are discussion history, the provider never deletes
 * them, and the nightly sweep drops its residual state row for closed PRs.
 */
export const previewDestroyStacks = [
  "web",
  "editor",
  "sophie",
  "adapter",
  "api",
  "shared",
] as const;

/**
 * The nightly sweep is the backstop for every preview-owned stack, including
 * Storybook previews, whose own workflow destroy job can be skipped on a
 * plain PR close.
 */
export const sweepDestroyStacks = ["storybook", ...previewDestroyStacks] as const;

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

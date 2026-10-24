import { ex } from "../expressions";
import type { Env } from "../model";
import { secret } from "./secrets";

const prNumberExpression = ex("github.event.pull_request.number");

export const prStage = `pr-${prNumberExpression}`;

export const previewConcurrencyGroup = `preview-${prNumberExpression}`;

export const storybookPreviewConcurrencyGroup = `storybook-preview-${prNumberExpression}`;

export const notClosedAction = "github.event.action != 'closed'";

export const closedAction = "github.event.action == 'closed'";

/**
 * Storybook preview credentials. Alchemy's GitHub provider (the
 * preview-comment resource) needs a token to post or update the comment.
 */
export const storybookPreviewEnv = (stage: string): Env => ({
  ALCHEMY_STAGE: stage,
  PULL_REQUEST: prNumberExpression,
  CLOUDFLARE_ACCOUNT_ID: secret("CLOUDFLARE_DEFAULT_ACCOUNT_ID"),
  ALCHEMY_ENV_FILE: "/dev/null",
  GITHUB_TOKEN: ex("github.token"),
});

/**
 * Preview stack credentials. Web, api, adapter, and sophie read the secrets
 * bundle, so they take the two extra bundle entries.
 */
export const previewEnv = (stage: string): Env => ({
  ALCHEMY_STAGE: stage,
  PULL_REQUEST: prNumberExpression,
  CLOUDFLARE_ACCOUNT_ID: secret("CLOUDFLARE_DEFAULT_ACCOUNT_ID"),
  ALCHEMY_ENV_FILE: "/dev/null",
  GITHUB_TOKEN: ex("github.token"),
});

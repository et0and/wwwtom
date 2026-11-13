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
 * The consolidated preview comment reads this to decide its heading. A failed
 * redeploy rewrites the same comment as failed instead of leaving the old
 * success text in place.
 */
export const previewSuccessEnv: Env = { PREVIEW_STATUS: "success" };

/**
 * Failure reporting runs after a failed deploy chain. The run URL makes the
 * comment actionable without opening the Actions tab.
 */
export const previewFailureEnv: Env = {
  PREVIEW_STATUS: "failure",
  PREVIEW_RUN_URL: ex(
    "format('{0}/{1}/actions/runs/{2}', github.server_url, github.repository, github.run_id)",
  ),
};

/**
 * Storybook preview credentials. Alchemy's GitHub provider (the
 * preview-comment resource) needs a token to post or update the comment.
 */
export const storybookPreviewEnv = (stage: string): Env => ({
  ALCHEMY_STAGE: stage,
  PULL_REQUEST: prNumberExpression,
  CLOUDFLARE_ACCOUNT_ID: secret("CLOUDFLARE_DEFAULT_ACCOUNT_ID"),
  CLOUDFLARE_API_TOKEN: secret("CLOUDFLARE_API_TOKEN"),
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
  CLOUDFLARE_API_TOKEN: secret("CLOUDFLARE_API_TOKEN"),
  TOM_SECRETS: secret("TOM_SECRETS"),
  AXIOM_TOKEN: secret("AXIOM_TOKEN"),
  ALCHEMY_ENV_FILE: "/dev/null",
  GITHUB_TOKEN: ex("github.token"),
});

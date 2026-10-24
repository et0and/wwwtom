import type { UsesStep } from "../model";
import { actionPins } from "./actions";
import { secret } from "./secrets";

/** The vault that holds this account's deploy-time secrets. */
const OP_VAULT = "wwwtom";

/**
 * The bundle is account-level in Cloudflare Secrets Store, so every stage must
 * read the same 1Password item. Stage-specific bundles would overwrite each
 * other on deploy and change the credentials production reads.
 */
const SHARED_SECRETS = `op://${OP_VAULT}/shared/TOM_SECRETS`;

const loadStep = (name: string, env: Readonly<Record<string, string>>): UsesStep => ({
  name,
  uses: actionPins.onepassword,
  with: { "export-env": true },
  env: {
    OP_SERVICE_ACCOUNT_TOKEN: secret("OP_SERVICE_ACCOUNT_TOKEN"),
    ...env,
  },
});

/**
 * Load the deploy secrets from 1Password into the job environment. The
 * workflow holds only `op://` pointers; the action resolves them at run time
 * and masks the values in logs.
 *
 * `item` selects the stage item: `production`, `staging`, or the shared
 * `preview` item. The item holds `CLOUDFLARE_API_TOKEN` and `AXIOM_TOKEN`;
 * `TOM_SECRETS` comes from the shared item.
 *
 * Runtime code never calls 1Password: Alchemy writes `TOM_SECRETS` to the
 * Cloudflare Secrets Store, and Workers read the binding.
 */
export const loadSecrets = (item: string): UsesStep =>
  loadStep("Load secrets from 1Password", {
    CLOUDFLARE_API_TOKEN: `op://${OP_VAULT}/${item}/CLOUDFLARE_API_TOKEN`,
    AXIOM_TOKEN: `op://${OP_VAULT}/${item}/AXIOM_TOKEN`,
    TOM_SECRETS: SHARED_SECRETS,
  });

/**
 * Storybook reads only the Cloudflare token. Do not give its PR-controlled
 * build the application bundle or the Axiom token.
 */
export const loadCloudflareToken = (item: string): UsesStep =>
  loadStep("Load Cloudflare token from 1Password", {
    CLOUDFLARE_API_TOKEN: `op://${OP_VAULT}/${item}/CLOUDFLARE_API_TOKEN`,
  });

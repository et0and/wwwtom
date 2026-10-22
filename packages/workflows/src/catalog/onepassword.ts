import type { UsesStep } from "../model";
import { actionPins } from "./actions";
import { secret } from "./secrets";

/** The vault that holds this account's deploy-time secrets. */
const OP_VAULT = "wwwtom";

/**
 * Load the deploy secrets from 1Password into the job environment. The
 * workflow holds only `op://` pointers; the action resolves them at run time
 * and masks the values in logs.
 *
 * `item` selects the stage item: `production`, `staging`, or the shared
 * `preview` item. The item must contain `CLOUDFLARE_API_TOKEN`, `TOM_SECRETS`,
 * and `AXIOM_TOKEN` fields.
 *
 * Runtime code never calls 1Password: Alchemy writes `TOM_SECRETS` to the
 * Cloudflare Secrets Store, and Workers read the binding.
 */
export const loadSecrets = (item: string): UsesStep => ({
  name: "Load secrets from 1Password",
  uses: actionPins.onepassword,
  with: { "export-env": true },
  env: {
    OP_SERVICE_ACCOUNT_TOKEN: secret("OP_SERVICE_ACCOUNT_TOKEN"),
    CLOUDFLARE_API_TOKEN: `op://${OP_VAULT}/${item}/CLOUDFLARE_API_TOKEN`,
    TOM_SECRETS: `op://${OP_VAULT}/${item}/TOM_SECRETS`,
    AXIOM_TOKEN: `op://${OP_VAULT}/${item}/AXIOM_TOKEN`,
  },
});

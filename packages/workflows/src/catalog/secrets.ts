import { ex } from "../expressions";
import type { Expression } from "../model";

/**
 * Repository, organisation, and app secrets referenced by workflows. The list
 * is closed on purpose: a misspelled name in a generated workflow would
 * otherwise fail only at run time.
 */
export const secretNames = [
  "ARENA_TOKEN",
  "AXIOM_TOKEN",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_DEFAULT_ACCOUNT_ID",
  "GITHUB_TOKEN",
  "OPENCODE_API_KEY",
  "SOURCEHUT_SSH_KEY",
  "TOM_SECRETS",
  "TURBO_CACHE_SIGNATURE_KEY",
  "TURBO_CACHE_TOKEN",
] as const;

export type SecretName = (typeof secretNames)[number];

export const secret = (name: SecretName): Expression => ex(`secrets.${name}`);

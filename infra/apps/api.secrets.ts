import { Effect, Option, Schema } from "effect";
import { TomSecretsSchema } from "@tom/schemas/secrets";
import { InfrastructureConfigError } from "@tom/types/errors";
import { parseAdminEmails } from "@tom/utils/services/config";

/**
 * Resolve deploy-time secrets for both tenants. Missing or blank values fail
 * the deploy: workers must never fall back to stale or hardcoded defaults.
 */
type TenantDeploySecrets = {
  readonly tomDevSecrets: Record<string, string>;
  readonly sophieDevSecrets: Record<string, string>;
  readonly tomAdminEmails: string;
  readonly sophieAdminEmails: string;
  readonly sophieGoogleClientId: string;
  readonly sophieGoogleClientSecret: string;
};

const required = (
  label: string,
  value: string | undefined,
  isPresent: (value: string) => boolean,
  message: string,
): Effect.Effect<string, InfrastructureConfigError> =>
  value !== undefined && isPresent(value)
    ? Effect.succeed(value)
    : Effect.fail(new InfrastructureConfigError({ variable: label, message }));

const adminEmails = (label: string, value: string | undefined) =>
  required(
    label,
    value,
    (emails) => parseAdminEmails(emails).length > 0,
    `${label} must list at least one admin email`,
  );

const bundleSecret = (label: string, value: string | undefined) =>
  required(label, value, (secret) => secret.trim() !== "", `${label} must be set in TOM_SECRETS`);

/** Deploy-time TOM_SECRETS copy; absent or malformed bundles read as empty. */
const parseBundle = (): Record<string, string> => {
  const raw = process.env.TOM_SECRETS;
  return raw === undefined
    ? {}
    : Option.getOrElse(Schema.decodeUnknownOption(TomSecretsSchema)(raw), () => ({}));
};

// Per-tenant keys never reach dev worker env under their package names.
const TENANT_KEYS = ["BETTER_AUTH_SECRET", "INTERNAL_API_TOKEN", "CMS_ADMIN_EMAILS"].flatMap(
  (key) => [`TOM_${key}`, `SOPHIE_${key}`],
);

/**
 * Dev workers get plain vars: the other tenant's provider keys and all
 * per-tenant names are stripped, and the tenant's own secrets resolve under
 * the shared name. Production rides the TOM_SECRETS binding instead.
 */
const tenantDevSecrets = (bundle: Record<string, string>, tenant: "TOM" | "SOPHIE") => {
  const foreign =
    tenant === "TOM"
      ? ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]
      : ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"];
  const secrets = Object.fromEntries(
    Object.entries(bundle).filter(([key]) => !foreign.includes(key) && !TENANT_KEYS.includes(key)),
  );
  const ownSecret = bundle[`${tenant}_BETTER_AUTH_SECRET`];
  const ownToken = bundle[`${tenant}_INTERNAL_API_TOKEN`];
  if (ownSecret !== undefined) secrets.BETTER_AUTH_SECRET = ownSecret;
  if (ownToken !== undefined) secrets.INTERNAL_API_TOKEN = ownToken;
  return secrets;
};

export const resolveDeploySecrets = (
  isAlchemyDev: boolean,
): Effect.Effect<TenantDeploySecrets, InfrastructureConfigError> =>
  Effect.gen(function* () {
    const bundle = parseBundle();
    const tomAdminEmails = yield* adminEmails(
      "TOM_CMS_ADMIN_EMAILS",
      process.env.TOM_CMS_ADMIN_EMAILS ?? bundle.TOM_CMS_ADMIN_EMAILS ?? bundle.CMS_ADMIN_EMAILS,
    );
    const sophieAdminEmails = yield* adminEmails(
      "SOPHIE_CMS_ADMIN_EMAILS",
      process.env.SOPHIE_CMS_ADMIN_EMAILS ?? bundle.SOPHIE_CMS_ADMIN_EMAILS,
    );
    const sophieGoogleClientId = yield* bundleSecret(
      "GOOGLE_CLIENT_ID",
      process.env.GOOGLE_CLIENT_ID ?? bundle.GOOGLE_CLIENT_ID,
    );
    const sophieGoogleClientSecret = yield* bundleSecret(
      "GOOGLE_CLIENT_SECRET",
      process.env.GOOGLE_CLIENT_SECRET ?? bundle.GOOGLE_CLIENT_SECRET,
    );
    return {
      tomDevSecrets: isAlchemyDev ? tenantDevSecrets(bundle, "TOM") : {},
      sophieDevSecrets: isAlchemyDev ? tenantDevSecrets(bundle, "SOPHIE") : {},
      tomAdminEmails,
      sophieAdminEmails,
      sophieGoogleClientId,
      sophieGoogleClientSecret,
    };
  });

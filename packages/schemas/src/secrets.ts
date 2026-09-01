import { Schema } from "effect";

/**
 * TOM_SECRETS is a JSON bundle seeded in the account-level Cloudflare
 * Secrets Store. Every value must be a string.
 */
export const TomSecretsSchema = Schema.fromJsonString(Schema.Record(Schema.String, Schema.String));

export type TomSecrets = Schema.Schema.Type<typeof TomSecretsSchema>;

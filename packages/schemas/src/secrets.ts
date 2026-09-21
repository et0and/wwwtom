import { Option, Schema, SchemaGetter } from "effect";

/**
 * TOM_SECRETS is a JSON bundle seeded in the account-level Cloudflare
 * Secrets Store. Every value must be a string.
 */
export const TomSecretsSchema = Schema.fromJsonString(Schema.Record(Schema.String, Schema.String));

const isMeaningfulSecret = Schema.makeFilter((value: string) => {
  if (value.length === 0) return "must not be empty";
  const lower = value.toLowerCase();
  if (lower === "undefined" || lower === "null") return "must not be a placeholder";
  return true;
});

const TrimmedSecretSchema = Schema.String.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((value: string) => value.trim()),
    encode: SchemaGetter.transform((value: string) => value),
  }),
  Schema.check(isMeaningfulSecret),
);

// Public codec twin of normalizeOptionalSecret.
export const OptionalSecretSchema = Schema.UndefinedOr(TrimmedSecretSchema);

export const normalizeOptionalSecret = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined;
  return Option.getOrUndefined(Schema.decodeOption(TrimmedSecretSchema)(value));
};

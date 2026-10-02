import { Option, Schema, SchemaGetter } from "effect";

/**
 * A comma-separated env list, as `CMS_ADMIN_EMAILS` is written in the Alchemy
 * stack. Blank entries are dropped, so a trailing comma is not an unusable
 * entry. Round-trips, so the codec is safe to use in both directions.
 */
export const CommaSeparated = Schema.String.pipe(
  Schema.decodeTo(Schema.Array(Schema.String), {
    decode: SchemaGetter.transform((value: string) =>
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
    encode: SchemaGetter.transform((entries: readonly string[]) => entries.join(",")),
  }),
);

/** Decode a comma-separated env list; an unset value yields no entries. */
export const parseCommaSeparated = (value: string | undefined): readonly string[] =>
  Option.getOrElse(Schema.decodeOption(CommaSeparated)(value ?? ""), () => []);

/**
 * A TCP port from a string config value. Blank is not a port — `Number("")`
 * is 0 and `Number("abc")` is NaN — so a blank or malformed value fails to
 * decode instead of silently becoming a plausible-looking wrong port.
 */
export const PortNumber = Schema.Trim.pipe(
  Schema.check(Schema.isMinLength(1)),
  Schema.decodeTo(Schema.Number, {
    decode: SchemaGetter.transform(Number),
    encode: SchemaGetter.transform(String),
  }),
  Schema.check(Schema.isBetween({ minimum: 1, maximum: 65535 })),
);

/**
 * A site served by the shared API and adapter workers. Each tenant owns a
 * private slice of the shared secrets bundle and trusts only its own origins,
 * so an unrecognised tag is deliberately never a default.
 */
export const TenantTag = Schema.Literals(["tom", "sophie"]);
export type TenantTag = typeof TenantTag.Type;

/** Env prefix for a tenant's private keys inside the shared secrets bundle. */
export const TENANT_PREFIXES = {
  tom: "TOM_",
  sophie: "SOPHIE_",
} as const satisfies Record<TenantTag, string>;

export type TenantPrefix = (typeof TENANT_PREFIXES)[TenantTag];

/** Parse a worker `TENANT` env value. Absent or unknown selects nothing. */
export const tenantTagFrom = (value: string | undefined): TenantTag | undefined =>
  Option.getOrUndefined(Schema.decodeUnknownOption(TenantTag)(value));

/** Bundle-key prefix for a tenant tag. Absent or unknown selects nothing. */
export const tenantPrefixFor = (value: string | undefined): TenantPrefix | undefined =>
  Option.match(Option.fromNullishOr(tenantTagFrom(value)), {
    onNone: () => undefined,
    onSome: (tag) => TENANT_PREFIXES[tag],
  });

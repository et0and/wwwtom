/**
 * The flag registry — the single source of truth for flag keys.
 *
 * Every flag on the site is declared here, once. The map keys are the flag
 * keys and the {@link FlagName} union is derived (`keyof`) rather than
 * maintained by hand, so a flag's key appears in exactly one place. Server
 * evaluation, the client reader, the snapshot shape, and static overrides
 * all key off {@link FlagName} — a typo anywhere is a compile error.
 */
import { Option, Schema } from "effect";
import { flag } from "@tom/flags/flag";

/**
 * The site's flags. Add a new flag here and it becomes typed everywhere
 * (server evaluate, client read, snapshot keys, static overrides) for free.
 */
export const flags = {
  "dark-mode": flag({ defaultOn: false }),
  "checkout-flow": flag({ defaultOn: true }),
};

/** The fully typed union of every declared flag key. */
export type FlagName = keyof typeof flags;

const flagNameMembers = Object.keys(flags).map((name) => Schema.Literal(name)) as [
  Schema.Literal<FlagName>,
  ...Schema.Literal<FlagName>[],
];

/**
 * Decodes a single flag-name string at its boundary. Unknown names decode
 * to `None`, so callers can drop them silently instead of crashing on a
 * stale client.
 */
export const FlagNameSchema = Schema.Union(flagNameMembers);

/**
 * Parse a comma-separated used-only flag list (the `?flags=a,b` query
 * shape) into known flag names. Unknown names are dropped; an empty input
 * yields an empty list.
 */
export const parseFlagList = (raw: string): readonly FlagName[] =>
  raw
    .split(",")
    .flatMap((part) => Option.toArray(Schema.decodeUnknownOption(FlagNameSchema)(part.trim())));

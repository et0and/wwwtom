/**
 * Flag declaration primitives.
 *
 * A flag is declared once, inside the registry, with a single on/off
 * default. The registry's map keys are the flag keys, and the {@link FlagName}
 * union is derived from them (`keyof`) — the key string is never written
 * twice and cannot drift.
 */
import { Schema } from "effect";

/**
 * The shape of a declared flag, modeled with Effect Schema so the type is
 * derived and every default is validated when the flag is constructed (a
 * mistyped default fails at module load, not at evaluation time).
 */
export const FlagSpec = Schema.Struct({
  defaultOn: Schema.Boolean,
});
export type FlagSpec = Schema.Schema.Type<typeof FlagSpec>;

/** Declare a flag with its on/off default. */
export const flag = (spec: FlagSpec): FlagSpec => FlagSpec.make(spec);

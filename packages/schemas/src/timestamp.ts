import { Schema } from "effect";

/**
 * A UTC instant decoded from an ISO string.
 *
 * `Schema.DateFromString` is the obvious choice and the wrong one: it builds the
 * value with the JavaScript `Date` constructor, which reads a zone-less string in
 * the *host* timezone. Workers run UTC and local dev does not, so one stored
 * `2026-09-21T10:30` would resolve to three different instants depending on where
 * it was read. `DateTimeUtcFromString` pins UTC, so one stored value always means
 * one instant.
 *
 * This is also why a `datetime-local` reading must be converted before it is
 * stored: it is a wall-clock time in the author's timezone, not a UTC instant.
 */
export const Timestamp = Schema.DateTimeUtcFromString;
export type Timestamp = typeof Timestamp.Type;

/** An absent timestamp. Distinct from an invalid one, which fails decoding. */
export const NullableTimestamp = Schema.NullOr(Timestamp);

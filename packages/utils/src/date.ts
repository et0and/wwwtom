import { DateTime, Option, Schema } from "effect";

/**
 * Timestamps render in NZ time regardless of where the process runs, so a
 * reader never sees a post shift a day between production (UTC) and local dev.
 */
const DISPLAY_TIME_ZONE = "Pacific/Auckland";

const dayFormatter = new Intl.DateTimeFormat("en-NZ", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: DISPLAY_TIME_ZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-NZ", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DISPLAY_TIME_ZONE,
});

/**
 * A timestamp as it arrives on the wire. The API and adapter hold
 * `DateTime.Utc`, but `JSON.stringify` writes it as an ISO string, so a client
 * reading a response never sees a `DateTime.Utc`. This codec is the client-side
 * half of the round trip.
 *
 * `DateTimeUtcFromString` rather than `DateFromString`: the latter reads a
 * zone-less string in the *host* timezone, so the same value would format
 * differently on a Worker (UTC) and in local dev. Pinning UTC keeps one stored
 * value meaning one instant everywhere.
 */
const WireTimestamp = Schema.DateTimeUtcFromString;

/**
 * Format a timestamp for display. An absent timestamp has nothing to show and
 * renders empty. An unparseable one also renders empty, because a timestamp
 * that reaches this far is a display detail, not a data problem worth throwing
 * over inside a render — the server already rejected a bad one at the decode
 * boundary. `Intl` rejects `DateTime.Utc`, so the instant crosses to a `Date`
 * here and nowhere else.
 */
const format = (formatter: Intl.DateTimeFormat, value: string | null): string => {
  const decoded = Option.getOrUndefined(Schema.decodeUnknownOption(WireTimestamp)(value));
  return decoded === undefined ? "" : formatter.format(DateTime.toDate(decoded));
};

export const formatDate = (value: string | null): string => format(dayFormatter, value);

export const formatDateTime = (value: string | null): string => format(dateTimeFormatter, value);

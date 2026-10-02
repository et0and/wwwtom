/**
 * A database timestamp as it goes on the wire. Kysely types the column
 * `Date | string`, so that union leaked all the way into the web client through
 * Eden, where the value is a string at runtime. JSON serialisation turns the
 * `Date` into a string anyway; doing it here keeps the response type equal to
 * what the client actually receives.
 */
export const toIsoTimestamp = (value: Date): string => value.toISOString();

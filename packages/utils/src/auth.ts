import { Array, Schema, SchemaGetter } from "effect";
import { parseCommaSeparated } from "@tom/schemas/env";

/** Trim and lowercase an allowlist entry once, at the config boundary. */
export const NormalizedEntry = Schema.String.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((entry: string) => entry.trim().toLowerCase()),
    encode: SchemaGetter.transform((entry: string) => entry.trim()),
  }),
);

const normalizeEntry = (entry: string): string => Schema.decodeUnknownSync(NormalizedEntry)(entry);

/** Normalize allowlist entries and drop blanks. */
export const toAdminEmailSet = (emails: ReadonlyArray<string>): ReadonlySet<string> =>
  new Set(
    Array.filter(
      Array.map(emails, (email) => normalizeEntry(email)),
      (email) => email !== "",
    ),
  );

/** Parse the comma-separated CMS_ADMIN_EMAILS env value. */
export const parseAdminEmails = (value: string | undefined): ReadonlySet<string> =>
  toAdminEmailSet(parseCommaSeparated(value));

/** Case-insensitive, whitespace-tolerant allowlist lookup. */
export const isAdminEmail = (email: string, allowlist: ReadonlySet<string>): boolean => {
  const normalized = normalizeEntry(email);
  return normalized !== "" && allowlist.has(normalized);
};

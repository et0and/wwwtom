import { Schema } from "effect";

/**
 * Guestbook entry as served over JSON (dates serialized). The same shape the
 * database row takes with `Date` fields turned into strings — the simulator
 * and the e2e fixture stores speak this shape (see `@tom/types/db`). A bad
 * fixture fails at import instead of rendering an unreadable signature.
 */
export const GuestbookEntrySchema = Schema.Struct({
  id: Schema.Finite,
  fediverse_username: Schema.String,
  fediverse_instance: Schema.String,
  display_name: Schema.NullOr(Schema.String),
  avatar_url: Schema.NullOr(Schema.String),
  message: Schema.String,
  created_at: Schema.String,
  updated_at: Schema.String,
});
export type GuestbookEntry = Schema.Schema.Type<typeof GuestbookEntrySchema>;

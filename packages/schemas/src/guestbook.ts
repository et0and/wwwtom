import { Schema } from "effect";

/**
 * The signed-in guestbook identity as served over JSON. There is deliberately
 * no access token: the Fediverse token stays on the server (it is not needed
 * after the account check) and the session cookie is an opaque token.
 */
export const GuestbookUserSchema = Schema.Struct({
  username: Schema.String,
  instance: Schema.String,
  display_name: Schema.String,
  avatar_url: Schema.String,
});
export type GuestbookUser = Schema.Schema.Type<typeof GuestbookUserSchema>;

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

import { Effect } from "effect";
import { DatabaseService, type GuestbookSession } from "@tom/db/service";
import type { GuestbookUser } from "@tom/schemas/guestbook";
import { AuthenticationError } from "@tom/types/errors";

/**
 * The public identity of a stored session. The access token never reaches a
 * response: the server keeps it only long enough to verify the account.
 */
const toUser = (session: GuestbookSession): GuestbookUser => ({
  username: session.fediverse_username.split("@")[0] ?? session.fediverse_username,
  instance: session.fediverse_instance,
  display_name: session.display_name ?? "",
  avatar_url: session.avatar_url ?? "",
});

/**
 * Resolve the cookie token to the signed-in identity, or null when the token
 * is unknown, expired, or absent. The client cannot choose its own identity:
 * every field comes from the row.
 */
export const guestbookUser = Effect.fn("guestbookUser")(function* (sessionToken: string) {
  if (sessionToken === "") return null;
  const db = yield* DatabaseService;
  const session = yield* db.getGuestbookSession(sessionToken);
  return session === null ? null : toUser(session);
});

/**
 * Sign for the session's identity. The unique constraint is the duplicate
 * check, so this is safe when two requests race. A missing session is a 401,
 * never an anonymous signature.
 */
export const signGuestbook = Effect.fn("signGuestbook")(function* (params: {
  sessionToken: string;
  message: string;
}) {
  const db = yield* DatabaseService;
  const session = yield* db.getGuestbookSession(params.sessionToken);
  if (session === null) {
    return yield* new AuthenticationError({ message: "Not authenticated" });
  }
  const entry = yield* db
    .createGuestbookEntry({
      fediverse_username: session.fediverse_username,
      fediverse_instance: session.fediverse_instance,
      display_name: session.display_name,
      avatar_url: session.avatar_url,
      message: params.message,
    })
    .pipe(Effect.annotateLogs({ userId: session.fediverse_username }));
  return entry;
});

/** Revoke the row. A cookie-only logout would leave a stolen token alive. */
export const endGuestbookSession = Effect.fn("endGuestbookSession")(function* (
  sessionToken: string,
) {
  if (sessionToken === "") return;
  const db = yield* DatabaseService;
  yield* db.deleteGuestbookSession(sessionToken);
});

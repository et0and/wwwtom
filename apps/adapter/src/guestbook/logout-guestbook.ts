import { Elysia } from "elysia";
import { Effect } from "effect";
import { getRequestEnv, logContextFromRequest } from "@tom/utils/worker";
import { guestbookSessionCookieSchema, successResponseSchema } from "../schemas";
import * as session from "./session";
import { runGuestbook } from "./shared";

export const logoutRoute = new Elysia().post(
  "/guestbook/logout",
  ({ cookie, request }) => {
    const env = getRequestEnv(request);
    const sessionToken = cookie.guestbook_session.value ?? "";
    if (sessionToken === "") {
      // Nothing to revoke; clearing the cookies needs no database.
      cookie.guestbook_session.remove();
      cookie.guestbook_user.remove();
      return { success: true };
    }
    return runGuestbook(
      env,
      Effect.gen(function* () {
        // Revoke before clearing: a cookie-only logout would leave a stolen
        // token usable until it expires.
        yield* session.endGuestbookSession(sessionToken);
        yield* Effect.sync(() => {
          cookie.guestbook_session.remove();
          cookie.guestbook_user.remove();
        });
        return { success: true };
      }),
      logContextFromRequest(request, "tom-adapter"),
    );
  },
  {
    cookie: guestbookSessionCookieSchema,
    response: { 200: successResponseSchema },
    detail: {
      description: "Revoke the guestbook session and clear its cookies",
      tags: ["guestbook"],
    },
  },
);

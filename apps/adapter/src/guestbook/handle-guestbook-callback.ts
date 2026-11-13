import { Elysia } from "elysia";
import { Duration, Effect } from "effect";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import { getRequestEnv, logContextFromRequest } from "@tom/utils/worker";
import { callbackQuerySchema, guestbookSessionCookieSchema } from "../schemas";
import * as auth from "./auth";
import { runGuestbook } from "./shared";

export const callbackRoute = new Elysia().get(
  "/guestbook/callback",
  ({ query, cookie, request }) => {
    const env = getRequestEnv(request);
    const pendingToken = cookie.guestbook_session.value ?? "";
    const adapterUrl = env.ADAPTER_URL ?? LOCAL_SERVICE_URLS.adapter;
    const redirectUri = `${adapterUrl}/guestbook/callback`;
    const returnUrl = env.GUESTBOOK_RETURN_URL ?? "http://localhost:3000/guestbook";
    // The state param is part of the OAuth contract but not of the typed
    // query schema; read it from the URL so a missing state is an empty
    // string (and therefore a mismatch) instead of a decode error.
    const state = new URL(request.url).searchParams.get("state") ?? "";

    const callbackProgram = Effect.gen(function* () {
      yield* Effect.logInfo("guestbook:auth:callback:start");
      const completed = yield* auth.completeAuth({
        code: query.code,
        state,
        session_token: pendingToken,
        redirectUri,
      });
      yield* Effect.sync(() => {
        cookie.guestbook_session.value = completed.sessionToken;
        cookie.guestbook_session.update({
          maxAge: Duration.toSeconds(auth.GUESTBOOK_SESSION_TTL),
          httpOnly: true,
          secure: env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
        // A stale identity cookie from the old flow must not survive login.
        cookie.guestbook_user.remove();
      });
      yield* Effect.logInfo("guestbook:auth:callback:success");
      return Response.redirect(returnUrl, 302);
    });

    return runGuestbook(
      env,
      callbackProgram.pipe(
        Effect.catch((error) =>
          Effect.gen(function* () {
            yield* Effect.logWarning("guestbook:auth:callback:failed", {
              reason: error._tag,
            });
            // Do not clear the cookie here. A stray `/guestbook/callback?code=x`
            // link carries a signed-in visitor's session cookie, and clearing
            // it would let any link sign them out. An invalid pending token is
            // already inert: its row is deleted, /me resolves to null, and the
            // cookie's 15-minute maxAge retires it.
            return Response.redirect(`${returnUrl}?error=auth_failed`, 302);
          }),
        ),
      ),
      logContextFromRequest(request, "tom-adapter"),
    );
  },
  {
    query: callbackQuerySchema,
    cookie: guestbookSessionCookieSchema,
    detail: {
      description: "Fediverse OAuth callback — opens a server-side session and redirects back",
      tags: ["guestbook"],
    },
  },
);

import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import { getRequestEnv, logContextFromRequest } from "@tom/utils/worker";
import { callbackQuerySchema, guestbookSessionCookieSchema } from "../schemas";
import * as auth from "./auth";
import { runGuestbook, userCookieSchema } from "./shared";

export const callbackRoute = new Elysia().get(
  "/guestbook/callback",
  ({ query, cookie, request }) => {
    const env = getRequestEnv(request);
    const sessionToken = cookie.guestbook_session.value ?? "";
    const adapterUrl = env.ADAPTER_URL ?? LOCAL_SERVICE_URLS.adapter;
    const redirectUri = `${adapterUrl}/guestbook/callback`;
    const returnUrl = env.GUESTBOOK_RETURN_URL ?? "http://localhost:3000/guestbook";

    const callbackProgram = Effect.gen(function* () {
      yield* Effect.logInfo("guestbook:auth:callback:start");
      const user = yield* auth.handleCallback({
        code: query.code,
        session_token: sessionToken,
        redirectUri,
      });
      const userCookieValue = yield* Schema.encodeEffect(userCookieSchema)(user);
      yield* Effect.sync(() => {
        cookie.guestbook_session.remove();
        cookie.guestbook_user.value = userCookieValue;
        cookie.guestbook_user.update({
          httpOnly: true,
          secure: env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
      });
      yield* Effect.logInfo("guestbook:auth:callback:success");
      return Response.redirect(returnUrl, 302);
    });

    return runGuestbook(
      env,
      callbackProgram.pipe(
        Effect.orElseSucceed(() => Response.redirect(`${returnUrl}?error=auth_failed`, 302)),
      ),
      logContextFromRequest(request, "tom-adapter"),
    );
  },
  {
    query: callbackQuerySchema,
    cookie: guestbookSessionCookieSchema,
    detail: {
      description: "Fediverse OAuth callback — sets the user cookie and redirects back",
      tags: ["guestbook"],
    },
  },
);

import { Elysia } from "elysia";
import { Effect } from "effect";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import { getRequestEnv, logContextFromRequest } from "@tom/utils/worker";
import {
  authUrlResponseSchema,
  guestbookSessionCookieSchema,
  handleBodySchema,
  problemDetailsSchema,
} from "../schemas";
import * as auth from "./auth";
import { runGuestbook } from "./shared";

export const initiateAuthRoute = new Elysia().post(
  "/guestbook/auth/initiate",
  ({ body, cookie, request }) => {
    const env = getRequestEnv(request);
    const adapterUrl = env.ADAPTER_URL ?? LOCAL_SERVICE_URLS.adapter;
    const redirectUri = `${adapterUrl}/guestbook/callback`;

    return runGuestbook(
      env,
      Effect.gen(function* () {
        yield* Effect.logInfo("guestbook:auth:initiate:start");
        const authResult = yield* auth.initiateAuth(body.handle, redirectUri);
        const finishInitiate = Effect.gen(function* () {
          yield* Effect.sync(() => {
            cookie.guestbook_session.value = authResult.sessionToken;
            cookie.guestbook_session.update({
              maxAge: 15 * 60,
              httpOnly: true,
              secure: env.NODE_ENV === "production",
              sameSite: "lax",
              path: "/",
            });
          });
          yield* Effect.logInfo("guestbook:auth:initiate:success");
          return { authUrl: authResult.authUrl };
        });
        return yield* finishInitiate.pipe(
          Effect.annotateLogs({ sessionId: authResult.sessionToken }),
        );
      }),
      logContextFromRequest(request, "tom-adapter"),
    );
  },
  {
    body: handleBodySchema,
    cookie: guestbookSessionCookieSchema,
    response: {
      200: authUrlResponseSchema,
      400: problemDetailsSchema,
      401: problemDetailsSchema,
      500: problemDetailsSchema,
    },
    detail: { description: "Start Fediverse OAuth for the guestbook", tags: ["guestbook"] },
  },
);

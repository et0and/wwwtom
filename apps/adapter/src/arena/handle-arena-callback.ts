import { Elysia } from "elysia";
import { Effect } from "effect";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import { getRequestEnv, logContextFromRequest } from "@tom/utils/worker";
import { arenaCallbackQuerySchema, arenaCookieSchema } from "../schemas";
import * as auth from "./auth";
import { runArenaAuth } from "./shared";

export const arenaCallbackRoute = new Elysia().get(
  "/arena/callback",
  ({ query, cookie, request }) => {
    const env = getRequestEnv(request);
    const sessionToken = cookie.arena_oauth_session.value ?? "";
    const adapterUrl = env.ADAPTER_URL ?? LOCAL_SERVICE_URLS.adapter;
    const redirectUri = `${adapterUrl}/arena/callback`;
    const returnUrl = env.ARENA_RETURN_URL ?? "http://localhost:3000";

    const program = Effect.gen(function* () {
      yield* Effect.logInfo("arena:auth:callback:start");
      const result = yield* auth.handleArenaCallback({
        code: query.code,
        state: query.state,
        sessionToken,
        redirectUri,
      });
      yield* Effect.sync(() => {
        cookie.arena_oauth_session.remove();
        cookie.arena_session.value = result.sessionId;
        cookie.arena_session.update({
          httpOnly: true,
          secure: env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
        });
      });
      yield* Effect.logInfo("arena:auth:callback:success");
      return Response.redirect(returnUrl, 302);
    });

    return runArenaAuth(
      request,
      program.pipe(
        Effect.orElseSucceed(() => Response.redirect(`${returnUrl}?arena_error=auth_failed`, 302)),
      ),
      logContextFromRequest(request, "tom-adapter"),
    );
  },
  {
    query: arenaCallbackQuerySchema,
    cookie: arenaCookieSchema,
    detail: {
      description: "are.na OAuth callback — stores the account and redirects back",
      tags: ["arena"],
    },
  },
);

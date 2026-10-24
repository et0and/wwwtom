import { Elysia } from "elysia";
import { Effect } from "effect";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import { getRequestEnv, logContextFromRequest } from "@tom/utils/worker";
import { arenaCookieSchema, authUrlResponseSchema, problemDetailsSchema } from "../schemas";
import * as auth from "./auth";
import { runArenaAuth } from "./shared";

export const initiateArenaAuthRoute = new Elysia().post(
  "/arena/auth/initiate",
  ({ cookie, request }) => {
    const env = getRequestEnv(request);
    const adapterUrl = env.ADAPTER_URL ?? LOCAL_SERVICE_URLS.adapter;
    const redirectUri = `${adapterUrl}/arena/callback`;

    return runArenaAuth(
      request,
      Effect.gen(function* () {
        yield* Effect.logInfo("arena:auth:initiate:start");
        const result = yield* auth.initiateArenaAuth(redirectUri);
        yield* Effect.sync(() => {
          cookie.arena_oauth_session.value = result.sessionToken;
          cookie.arena_oauth_session.update({
            maxAge: 15 * 60,
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
          });
        });
        yield* Effect.logInfo("arena:auth:initiate:success");
        return { authUrl: result.authUrl };
      }),
      logContextFromRequest(request, "tom-adapter"),
    );
  },
  {
    cookie: arenaCookieSchema,
    response: {
      200: authUrlResponseSchema,
      400: problemDetailsSchema,
      401: problemDetailsSchema,
      500: problemDetailsSchema,
    },
    detail: { description: "Start are.na OAuth to comment on a block", tags: ["arena"] },
  },
);

import { Elysia } from "elysia";
import { Effect } from "effect";
import { ProblemType } from "@tom/constants/problem";
import { HttpStatus } from "@tom/constants/http";
import { ProfanityError } from "@tom/types/errors";
import { checkProfanity } from "@tom/utils/profanity";
import { getRequestEnv, logContextFromRequest, toProblemResponse } from "@tom/utils/worker";
import {
  guestbookUserCookieSchema,
  messageBodySchema,
  problemDetailsSchema,
  successResponseSchema,
} from "../schemas";
import * as auth from "./auth";
import { guestbookUserFromCookie, notifyGuestbookSign, runGuestbook } from "./shared";

export const signRoute = new Elysia().post(
  "/guestbook/sign",
  ({ body, cookie, request }) => {
    const env = getRequestEnv(request);
    const user = guestbookUserFromCookie(cookie.guestbook_user.value);
    if (!user) {
      return toProblemResponse(HttpStatus.Unauthorized, "Not authenticated", {
        type: ProblemType.Unauthorized,
        instance: request.url,
      });
    }

    return runGuestbook(
      env,
      Effect.gen(function* () {
        yield* Effect.logInfo("guestbook:sign:start");
        const profanityCheck = checkProfanity(body.message);
        if (profanityCheck.hasProfanity) {
          return yield* new ProfanityError({ message: profanityCheck.message });
        }

        const entry = yield* auth.signGuestbook({ user, message: body.message });
        yield* notifyGuestbookSign(entry);
        yield* Effect.logInfo("guestbook:sign:success");
        return { success: true };
      }),
      logContextFromRequest(request, "tom-adapter"),
    );
  },
  {
    body: messageBodySchema,
    cookie: guestbookUserCookieSchema,
    response: {
      200: successResponseSchema,
      400: problemDetailsSchema,
      401: problemDetailsSchema,
      500: problemDetailsSchema,
    },
    detail: { description: "Sign the guestbook (requires the user cookie)", tags: ["guestbook"] },
  },
);

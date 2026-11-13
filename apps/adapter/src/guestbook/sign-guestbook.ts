import { Elysia } from "elysia";
import { Effect } from "effect";
import { ProblemType } from "@tom/constants/problem";
import { HttpStatus } from "@tom/constants/http";
import { ProfanityError } from "@tom/types/errors";
import { checkProfanity } from "@tom/utils/profanity";
import { getRequestEnv, logContextFromRequest, toProblemResponse } from "@tom/utils/worker";
import {
  guestbookSessionCookieSchema,
  messageBodySchema,
  problemDetailsSchema,
  successResponseSchema,
} from "../schemas";
import * as session from "./session";
import { notifyGuestbookSign, runGuestbook } from "./shared";

export const signRoute = new Elysia().post(
  "/guestbook/sign",
  ({ body, cookie, request }) => {
    const env = getRequestEnv(request);
    const sessionToken = cookie.guestbook_session.value ?? "";
    if (sessionToken === "") {
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

        const entry = yield* session.signGuestbook({ sessionToken, message: body.message });
        yield* notifyGuestbookSign(entry);
        yield* Effect.logInfo("guestbook:sign:success");
        return { success: true };
      }),
      logContextFromRequest(request, "tom-adapter"),
    );
  },
  {
    body: messageBodySchema,
    cookie: guestbookSessionCookieSchema,
    response: {
      200: successResponseSchema,
      400: problemDetailsSchema,
      401: problemDetailsSchema,
      409: problemDetailsSchema,
      500: problemDetailsSchema,
    },
    detail: { description: "Sign the guestbook (requires a session)", tags: ["guestbook"] },
  },
);

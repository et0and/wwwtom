import { Elysia } from "elysia";
import { Effect } from "effect";
import { ArenaClient } from "@tom/arena/client";
import { logContextFromRequest } from "@tom/utils/worker";
import { HttpStatus } from "@tom/constants/http";
import { HttpError } from "@tom/types/errors";
import { arenaCookieSchema, commentBodySchema, problemDetailsSchema } from "../schemas";
import * as auth from "./auth";
import { BlockIdParamsSchema, runArenaAuth } from "./shared";

export const createBlockCommentRoute = new Elysia().post(
  "/arena/blocks/:id/comments",
  ({ params, body, cookie, request }) => {
    const sessionId = cookie.arena_session.value ?? "";
    return runArenaAuth(
      request,
      Effect.gen(function* () {
        yield* Effect.logInfo("arena:comments:create:start");
        const token = yield* auth.arenaTokenForSession(sessionId);
        if (token === null) {
          return yield* new HttpError({
            message: "Sign in with are.na to comment",
            status: HttpStatus.Unauthorized,
          });
        }
        // No retry: a retried create would post the same comment twice.
        return yield* new ArenaClient({ token }).block(params.id).comment(body.body);
      }),
      logContextFromRequest(request, "tom-adapter"),
    );
  },
  {
    params: BlockIdParamsSchema,
    body: commentBodySchema,
    cookie: arenaCookieSchema,
    response: {
      400: problemDetailsSchema,
      401: problemDetailsSchema,
      500: problemDetailsSchema,
    },
    detail: { description: "Comment on an are.na block as the signed-in user", tags: ["arena"] },
  },
);

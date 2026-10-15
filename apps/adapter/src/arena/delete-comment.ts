import { Elysia } from "elysia";
import { Effect } from "effect";
import { ArenaClient } from "@tom/arena/client";
import { logContextFromRequest } from "@tom/utils/worker";
import { HttpStatus } from "@tom/constants/http";
import { HttpError } from "@tom/types/errors";
import { arenaCookieSchema, problemDetailsSchema, successResponseSchema } from "../schemas";
import * as auth from "./auth";
import { CommentIdParamsSchema, runArenaAuth } from "./shared";

export const deleteCommentRoute = new Elysia().delete(
  "/arena/comments/:id",
  ({ params, cookie, request }) => {
    const sessionId = cookie.arena_session.value ?? "";
    return runArenaAuth(
      request,
      Effect.gen(function* () {
        yield* Effect.logInfo("arena:comments:delete:start");
        const token = yield* auth.arenaTokenForSession(sessionId);
        if (token === null) {
          return yield* new HttpError({
            message: "Sign in with are.na to delete a comment",
            status: HttpStatus.Unauthorized,
          });
        }
        // are.na only lets an author delete their own comment; a foreign id
        // comes back as 403 and is passed through.
        yield* new ArenaClient({ token }).comments.delete(params.id);
        return { success: true };
      }),
      logContextFromRequest(request, "tom-adapter"),
    );
  },
  {
    params: CommentIdParamsSchema,
    cookie: arenaCookieSchema,
    response: {
      200: successResponseSchema,
      401: problemDetailsSchema,
      500: problemDetailsSchema,
    },
    detail: { description: "Delete your own are.na comment", tags: ["arena"] },
  },
);

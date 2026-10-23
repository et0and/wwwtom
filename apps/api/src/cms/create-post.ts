import { Elysia } from "elysia";
import { Effect } from "effect";
import { CmsPostInputSchema } from "@tom/schemas/cms";
import { createPost } from "./operations";
import { decodeBoundary, runWrite, withAuthor } from "./shared";

export const createPostRoute = new Elysia().post("/posts", ({ body, request }) =>
  runWrite(
    request,
    withAuthor(request, ({ db, actor, adapterUrl }) =>
      Effect.gen(function* () {
        const input = yield* decodeBoundary(
          CmsPostInputSchema,
          body,
          "Invalid post body",
          "create_post",
        );
        return yield* createPost(db, input, actor, adapterUrl);
      }),
    ),
  ),
);

import { Elysia } from "elysia";
import { Effect } from "effect";
import { deletePost } from "./operations";
import { decodeSlugParams, runWrite, withAuthor } from "./shared";

export const deletePostRoute = new Elysia().delete("/posts/:slug", ({ params, request }) =>
  runWrite(
    request,
    withAuthor(request, ({ db }) =>
      Effect.gen(function* () {
        const { slug } = yield* decodeSlugParams(params, "delete_post");
        return yield* deletePost(db, slug);
      }),
    ),
  ),
);

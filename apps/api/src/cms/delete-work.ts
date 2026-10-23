import { Elysia } from "elysia";
import { Effect } from "effect";
import { deleteWork } from "./operations";
import { decodeSlugParams, runWrite, withWorksAuthor } from "./shared";

export const deleteWorkRoute = new Elysia().delete("/works/:slug", ({ params, request }) =>
  runWrite(
    request,
    withWorksAuthor(request, ({ db }) =>
      Effect.gen(function* () {
        const { slug } = yield* decodeSlugParams(params, "delete_work");
        return yield* deleteWork(db, slug);
      }),
    ),
  ),
);

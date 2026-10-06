import { Elysia } from "elysia";
import { Effect } from "effect";
import { deleteCategory } from "./operations";
import { decodeSlugParams, runWrite, withAuthor } from "./shared";

export const deleteCategoryRoute = new Elysia().delete("/categories/:slug", ({ params, request }) =>
  runWrite(
    request,
    withAuthor(request, ({ db }) =>
      Effect.gen(function* () {
        const { slug } = yield* decodeSlugParams(params, "delete_category");
        return yield* deleteCategory(db, slug);
      }),
    ),
  ),
);

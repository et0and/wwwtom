import { Elysia } from "elysia";
import { Effect } from "effect";
import { CmsPostInputSchema } from "@tom/schemas/cms";
import { updatePost } from "./operations";
import { decodeBoundary, decodeSlugParams, runWrite, withAuthor } from "./shared";

export const updatePostRoute = new Elysia().put("/posts/:slug", ({ body, params, request }) =>
  runWrite(
    request,
    withAuthor(request, ({ db, actor, adapterUrl }) =>
      Effect.gen(function* () {
        const { slug } = yield* decodeSlugParams(params, "update_post");
        const input = yield* decodeBoundary(
          CmsPostInputSchema,
          body,
          "Invalid post body",
          "update_post",
        );
        return yield* updatePost(db, slug, input, actor, adapterUrl);
      }),
    ),
  ),
);

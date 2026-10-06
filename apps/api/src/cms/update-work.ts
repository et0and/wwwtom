import { Elysia } from "elysia";
import { Effect } from "effect";
import { CmsWorkInputSchema } from "@tom/schemas/cms";
import { updateWork } from "./operations";
import { decodeBoundary, decodeSlugParams, runWrite, withWorksAuthor } from "./shared";

export const updateWorkRoute = new Elysia().put("/works/:slug", ({ body, params, request }) =>
  runWrite(
    request,
    withWorksAuthor(request, ({ db, actor, adapterUrl }) =>
      Effect.gen(function* () {
        const { slug } = yield* decodeSlugParams(params, "update_work");
        const input = yield* decodeBoundary(
          CmsWorkInputSchema,
          body,
          "Invalid work body",
          "update_work",
        );
        return yield* updateWork(db, slug, input, actor, adapterUrl);
      }),
    ),
  ),
);

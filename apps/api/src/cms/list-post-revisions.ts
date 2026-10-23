import { Elysia } from "elysia";
import { Effect } from "effect";
import { listRevisions } from "./operations";
import { decodeSlugParams, runWrite, withAuthor } from "./shared";

export const listPostRevisionsRoute = new Elysia().get(
  "/posts/:slug/revisions",
  ({ params, request }) =>
    runWrite(
      request,
      withAuthor(request, ({ db }) =>
        Effect.gen(function* () {
          const { slug } = yield* decodeSlugParams(params, "list_revisions");
          return yield* listRevisions(db, "post", slug);
        }),
      ),
    ),
);

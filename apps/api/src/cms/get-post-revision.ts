import { Elysia } from "elysia";
import { Effect } from "effect";
import { getRevision } from "./operations";
import { decodeRevisionParams, runWrite, withAuthor } from "./shared";

export const getPostRevisionRoute = new Elysia().get(
  "/posts/:slug/revisions/:revId",
  ({ params, request }) =>
    runWrite(
      request,
      withAuthor(request, ({ db }) =>
        Effect.gen(function* () {
          const { slug, revId } = yield* decodeRevisionParams(params, "get_revision");
          return yield* getRevision(db, "post", slug, revId);
        }),
      ),
    ),
);

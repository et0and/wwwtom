import { Elysia } from "elysia";
import { Effect } from "effect";
import { restoreRevision } from "./operations";
import { decodeRestoreInput, decodeSlugParams, runWrite, withAuthor } from "./shared";

export const restorePostRevisionRoute = new Elysia().post(
  "/posts/:slug/restore",
  ({ body, params, request }) =>
    runWrite(
      request,
      withAuthor(request, ({ db, actor, adapterUrl }) =>
        Effect.gen(function* () {
          const { slug } = yield* decodeSlugParams(params, "restore_revision");
          const { revisionId } = yield* decodeRestoreInput(body, "restore_revision");
          return yield* restoreRevision(db, "post", slug, revisionId, actor, adapterUrl);
        }),
      ),
    ),
);

import { Elysia } from "elysia";
import { Effect } from "effect";
import { restoreRevision } from "./operations";
import { decodeRestoreInput, decodeSlugParams, runWrite, withWorksAuthor } from "./shared";

export const restoreWorkRevisionRoute = new Elysia().post(
  "/works/:slug/restore",
  ({ body, params, request }) =>
    runWrite(
      request,
      withWorksAuthor(request, ({ db, actor, adapterUrl }) =>
        Effect.gen(function* () {
          const { slug } = yield* decodeSlugParams(params, "restore_revision");
          const { revisionId } = yield* decodeRestoreInput(body, "restore_revision");
          return yield* restoreRevision(db, "work", slug, revisionId, actor, adapterUrl);
        }),
      ),
    ),
);

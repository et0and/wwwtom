import { Elysia } from "elysia";
import { Effect } from "effect";
import { deleteMedia } from "./operations";
import { decodeMediaParams, runWrite, withAuthor } from "./shared";

export const deleteMediaRoute = new Elysia().delete("/media/:id", ({ params, request }) =>
  runWrite(
    request,
    withAuthor(request, ({ db, r2 }) =>
      Effect.gen(function* () {
        const { id } = yield* decodeMediaParams(params, "delete_media");
        return yield* deleteMedia(db, r2, id);
      }),
    ),
  ),
);

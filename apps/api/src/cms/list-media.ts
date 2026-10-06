import { Elysia } from "elysia";
import { Effect } from "effect";
import { listMedia } from "./operations";
import { decodePagingQuery, runWrite, withAuthor } from "./shared";

export const listMediaRoute = new Elysia().get("/media", ({ query, request }) =>
  runWrite(
    request,
    withAuthor(request, ({ db }) =>
      Effect.gen(function* () {
        const paging = yield* decodePagingQuery(query, "list_media");
        return yield* listMedia(db, paging);
      }),
    ),
  ),
);

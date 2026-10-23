import { Elysia } from "elysia";
import { Effect } from "effect";
import { getMediaUsage } from "./operations";
import { decodeMediaParams, runWrite, withAuthor } from "./shared";

export const getMediaUsageRoute = new Elysia().get("/media/:id/usage", ({ params, request }) =>
  runWrite(
    request,
    withAuthor(request, ({ db }) =>
      Effect.gen(function* () {
        const { id } = yield* decodeMediaParams(params, "get_media_usage");
        return yield* getMediaUsage(db, id);
      }),
    ),
  ),
);

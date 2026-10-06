import { Elysia } from "elysia";
import { Effect } from "effect";
import { createMedia } from "./operations";
import { decodeUploadBody, runWrite, withAuthor } from "./shared";

export const createMediaRoute = new Elysia().post("/media", ({ body, request }) =>
  runWrite(
    request,
    withAuthor(request, ({ db, r2 }) =>
      Effect.gen(function* () {
        const upload = yield* decodeUploadBody(body, "create_media");
        return yield* createMedia(db, r2, upload);
      }),
    ),
  ),
);

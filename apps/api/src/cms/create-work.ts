import { Elysia } from "elysia";
import { Effect } from "effect";
import { CmsWorkInputSchema } from "@tom/schemas/cms";
import { createWork } from "./operations";
import { decodeBoundary, runWrite, withWorksAuthor } from "./shared";

export const createWorkRoute = new Elysia().post("/works", ({ body, request }) =>
  runWrite(
    request,
    withWorksAuthor(request, ({ db, actor, adapterUrl }) =>
      Effect.gen(function* () {
        const input = yield* decodeBoundary(
          CmsWorkInputSchema,
          body,
          "Invalid work body",
          "create_work",
        );
        return yield* createWork(db, input, actor, adapterUrl);
      }),
    ),
  ),
);

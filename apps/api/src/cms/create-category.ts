import { Elysia } from "elysia";
import { Effect } from "effect";
import { CmsCategoryInputSchema } from "@tom/schemas/cms";
import { createCategory } from "./operations";
import { decodeBoundary, runWrite, withAuthor } from "./shared";

export const createCategoryRoute = new Elysia().post("/categories", ({ body, request }) =>
  runWrite(
    request,
    withAuthor(request, ({ db }) =>
      Effect.gen(function* () {
        const input = yield* decodeBoundary(
          CmsCategoryInputSchema,
          body,
          "Invalid category body",
          "create_category",
        );
        return yield* createCategory(db, input);
      }),
    ),
  ),
);

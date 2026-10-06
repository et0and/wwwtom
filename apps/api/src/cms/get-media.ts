import { Elysia } from "elysia";
import { Effect } from "effect";
import { getMediaById } from "./operations";
import { cmsMediaParamsSchema, decodeMediaParams, withCms } from "./shared";

export const getMediaRoute = new Elysia().get(
  "/media/:id",
  ({ params, request }) =>
    withCms(request, (db) =>
      Effect.gen(function* () {
        const { id } = yield* decodeMediaParams(params, "get_media");
        return yield* getMediaById(db, id);
      }),
    ),
  {
    params: cmsMediaParamsSchema,
    detail: { description: "Get media metadata by id", tags: ["cms"] },
  },
);

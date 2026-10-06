import { Elysia } from "elysia";
import { Effect } from "effect";
import { getRequestEnv } from "@tom/utils/worker";
import { getWorkBySlug } from "./operations";
import { cmsSlugParamsSchema, decodeSlugParams, optionalSession, withCms } from "./shared";

export const getWorkRoute = new Elysia().get(
  "/works/:slug",
  ({ params, request }) =>
    withCms(request, (db) =>
      Effect.gen(function* () {
        const { slug } = yield* decodeSlugParams(params, "get_work");
        const isAdmin = yield* optionalSession(request, getRequestEnv(request));
        return yield* getWorkBySlug(db, slug, isAdmin ? "all" : "published");
      }),
    ),
  {
    params: cmsSlugParamsSchema,
    detail: { description: "Get a work by slug (drafts need a session)", tags: ["cms"] },
  },
);

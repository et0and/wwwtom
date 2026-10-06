import { Elysia } from "elysia";
import { Effect } from "effect";
import { getRequestEnv } from "@tom/utils/worker";
import { getPostBySlug } from "./operations";
import { cmsSlugParamsSchema, decodeSlugParams, optionalSession, withCms } from "./shared";

export const getPostRoute = new Elysia().get(
  "/posts/:slug",
  ({ params, request }) =>
    withCms(request, (db) =>
      Effect.gen(function* () {
        const { slug } = yield* decodeSlugParams(params, "get_post");
        const isAdmin = yield* optionalSession(request, getRequestEnv(request));
        return yield* getPostBySlug(db, slug, isAdmin ? "all" : "published");
      }),
    ),
  {
    params: cmsSlugParamsSchema,
    detail: { description: "Get a post by slug (drafts need a session)", tags: ["cms"] },
  },
);

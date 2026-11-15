import { Elysia } from "elysia";
import { proxyCachedCms, SlugParamsSchema } from "./shared";
import { sessionHeaders } from "../auth/forward";

export const getPostRoute = new Elysia().get(
  "/content/posts/:slug",
  async ({ params, request, set }) =>
    proxyCachedCms(request, set, "post", (api) =>
      api.posts({ slug: params.slug }).get({ headers: sessionHeaders(request) }),
    ),
  {
    params: SlugParamsSchema,
    detail: { description: "Get a post by slug (drafts need a session)", tags: ["cms"] },
  },
);

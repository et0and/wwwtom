import { Elysia } from "elysia";
import { extractArenaRefs, proxyCachedCms, sessionHeaders, SlugParamsSchema } from "./shared";

export const getPostRoute = new Elysia().get(
  "/content/posts/:slug",
  async ({ params, request, set }) => {
    const post = await proxyCachedCms(request, set, "post", (api) =>
      api.posts({ slug: params.slug }).get({ headers: sessionHeaders(request) }),
    );
    return { ...post, arenaBlocks: extractArenaRefs(post.content) };
  },
  {
    params: SlugParamsSchema,
    detail: { description: "Get a post by slug (drafts need a session)", tags: ["cms"] },
  },
);

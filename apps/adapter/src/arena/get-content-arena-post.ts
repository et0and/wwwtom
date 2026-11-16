import { Elysia } from "elysia";
import { arenaApi, arenaSlugParamsSchema, proxyArena } from "./shared";

export const contentPostRoute = new Elysia().get(
  "/content/arena/posts/:slug",
  async ({ params, request, set }) => {
    const api = await arenaApi(request);
    return proxyArena(api.internal.content.arena.posts({ slug: params.slug }).get(), set, "post");
  },
  {
    params: arenaSlugParamsSchema,
    detail: { description: "Get a post from are.na", tags: ["arena-content"] },
  },
);

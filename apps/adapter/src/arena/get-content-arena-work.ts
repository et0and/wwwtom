import { Elysia } from "elysia";
import { arenaApi, arenaSlugParamsSchema, proxyArena } from "./shared";

export const contentWorkRoute = new Elysia().get(
  "/content/arena/works/:slug",
  async ({ params, request, set }) => {
    const api = await arenaApi(request);
    return proxyArena(api.internal.content.arena.works({ slug: params.slug }).get(), set, "work");
  },
  {
    params: arenaSlugParamsSchema,
    detail: { description: "Get a work from are.na", tags: ["arena-content"] },
  },
);

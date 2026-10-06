import { Elysia } from "elysia";
import { extractArenaRefs, proxyCachedCms, sessionHeaders, SlugParamsSchema } from "./shared";

export const getWorkRoute = new Elysia().get(
  "/content/works/:slug",
  async ({ params, request, set }) => {
    const work = await proxyCachedCms(request, set, "work", (api) =>
      api.works({ slug: params.slug }).get({ headers: sessionHeaders(request) }),
    );
    return { ...work, arenaBlocks: extractArenaRefs(work.content) };
  },
  {
    params: SlugParamsSchema,
    detail: { description: "Get a work by slug (drafts need a session)", tags: ["cms"] },
  },
);

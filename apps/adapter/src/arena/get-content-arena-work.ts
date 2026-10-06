import { Elysia } from "elysia";
import { ARENA_WORK_CHANNEL_SLUG } from "@tom/constants/arena";
import { setPublicContentCache } from "../content-cache";
import { arenaSlugParamsSchema, getArenaContent, requireArenaTenant } from "./shared";

export const contentWorkRoute = new Elysia().get(
  "/content/arena/works/:slug",
  async ({ params, request, set }) => {
    requireArenaTenant(request);
    const entry = await getArenaContent(request, ARENA_WORK_CHANNEL_SLUG, params.slug, "Work");
    setPublicContentCache(request, set);
    return entry;
  },
  {
    params: arenaSlugParamsSchema,
    detail: { description: "Get a work from are.na", tags: ["arena-content"] },
  },
);

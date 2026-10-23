import { Elysia } from "elysia";
import { ARENA_POSTS_CHANNEL_SLUG } from "@tom/constants/arena";
import { setPublicContentCache } from "../content-cache";
import { arenaSlugParamsSchema, getArenaContent, requireArenaTenant } from "./shared";

export const contentPostRoute = new Elysia().get(
  "/content/arena/posts/:slug",
  async ({ params, request, set }) => {
    requireArenaTenant(request);
    const entry = await getArenaContent(request, ARENA_POSTS_CHANNEL_SLUG, params.slug, "Post");
    setPublicContentCache(request, set);
    return entry;
  },
  {
    params: arenaSlugParamsSchema,
    detail: { description: "Get a post from are.na", tags: ["arena-content"] },
  },
);

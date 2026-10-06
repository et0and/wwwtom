import { Elysia } from "elysia";
import { ARENA_POSTS_CHANNEL_SLUG } from "@tom/constants/arena";
import { setPublicContentCache } from "../content-cache";
import { arenaListQuerySchema, listArenaContent, requireArenaTenant } from "./shared";

export const contentPostsRoute = new Elysia().get(
  "/content/arena/posts",
  async ({ query, request, set }) => {
    requireArenaTenant(request);
    const entries = await listArenaContent(request, ARENA_POSTS_CHANNEL_SLUG, {
      page: query.page,
      per: query.pageSize,
    });
    setPublicContentCache(request, set);
    return entries;
  },
  {
    query: arenaListQuerySchema,
    detail: { description: "List posts from are.na", tags: ["arena-content"] },
  },
);

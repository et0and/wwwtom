import { Elysia } from "elysia";
import { ARENA_WORK_CHANNEL_SLUG } from "@tom/constants/arena";
import { setPublicContentCache } from "../content-cache";
import { arenaListQuerySchema, listArenaContent, requireArenaTenant } from "./shared";

export const contentWorksRoute = new Elysia().get(
  "/content/arena/works",
  async ({ query, request, set }) => {
    requireArenaTenant(request);
    const entries = await listArenaContent(request, ARENA_WORK_CHANNEL_SLUG, {
      page: query.page,
      per: query.pageSize,
    });
    setPublicContentCache(request, set);
    return entries;
  },
  {
    query: arenaListQuerySchema,
    detail: { description: "List works from are.na", tags: ["arena-content"] },
  },
);

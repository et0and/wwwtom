import { Elysia } from "elysia";
import { setPublicContentCache } from "../content-cache";
import { arenaFeed, feedQuerySchema, requireArenaTenant } from "./shared";

export const contentFeedRoute = new Elysia().get(
  "/content/arena/feed",
  async ({ query, request, set }) => {
    requireArenaTenant(request);
    const feed = await arenaFeed(request, query.limit ?? 20);
    setPublicContentCache(request, set);
    return feed;
  },
  {
    query: feedQuerySchema,
    detail: { description: "Recent are.na posts for feeds", tags: ["arena-content"] },
  },
);

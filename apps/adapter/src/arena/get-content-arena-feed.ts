import { Elysia } from "elysia";
import { arenaApi, feedQuerySchema, proxyArena } from "./shared";

export const contentFeedRoute = new Elysia().get(
  "/content/arena/feed",
  async ({ query, request, set }) => {
    const api = await arenaApi(request);
    return proxyArena(
      api.internal.content.arena.feed.get({ query: { limit: query.limit } }),
      set,
      "feed",
    );
  },
  {
    query: feedQuerySchema,
    detail: { description: "Recent are.na posts for feeds", tags: ["arena-content"] },
  },
);

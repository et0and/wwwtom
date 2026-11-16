import { Elysia } from "elysia";
import { arenaApi, arenaListQuerySchema, proxyArena } from "./shared";

export const contentPostsRoute = new Elysia().get(
  "/content/arena/posts",
  async ({ query, request, set }) => {
    const api = await arenaApi(request);
    return proxyArena(
      api.internal.content.arena.posts.get({
        query: { page: query.page, pageSize: query.pageSize },
      }),
      set,
      "posts",
    );
  },
  {
    query: arenaListQuerySchema,
    detail: { description: "List posts from are.na", tags: ["arena-content"] },
  },
);

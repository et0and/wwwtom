import { Elysia } from "elysia";
import { arenaApi, arenaListQuerySchema, proxyArena } from "./shared";

export const contentWorksRoute = new Elysia().get(
  "/content/arena/works",
  async ({ query, request, set }) => {
    const api = await arenaApi(request);
    return proxyArena(
      api.internal.content.arena.works.get({
        query: { page: query.page, pageSize: query.pageSize },
      }),
      set,
      "works",
    );
  },
  {
    query: arenaListQuerySchema,
    detail: { description: "List works from are.na", tags: ["arena-content"] },
  },
);

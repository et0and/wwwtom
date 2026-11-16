import { Elysia } from "elysia";
import { searchQuerySchema } from "../schemas";
import { arenaApi, proxyArena, toPaginationAttributes } from "./shared";

export const searchRoute = new Elysia().get(
  "/arena/search",
  async ({ query, request, set }) => {
    const api = await arenaApi(request);
    return proxyArena(
      api.internal.arena.search.get({
        query: { query: query.query, type: query.type, ...toPaginationAttributes(query) },
      }),
      set,
      "search",
    );
  },
  {
    query: searchQuerySchema,
    detail: { description: "Search Are.na", tags: ["arena"] },
  },
);

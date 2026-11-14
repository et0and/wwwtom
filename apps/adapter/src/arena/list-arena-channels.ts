import { Elysia } from "elysia";
import { paginationQuerySchema } from "../schemas";
import { arenaApi, proxyArena, pagingParams } from "./shared";

export const listChannelsRoute = new Elysia().get(
  "/arena/channels",
  async ({ query, request, set }) => {
    const api = await arenaApi(request);
    return proxyArena(api.internal.arena.channels.get(pagingParams(query)), set, "channels");
  },
  {
    query: paginationQuerySchema,
    detail: { description: "List channels (authenticated)", tags: ["arena"] },
  },
);

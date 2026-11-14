import { Elysia } from "elysia";
import { paginationQuerySchema } from "../schemas";
import { arenaApi, IdOrSlugParamsSchema, proxyArena, pagingParams } from "./shared";

export const getUserChannelsRoute = new Elysia().get(
  "/arena/users/:id/channels",
  async ({ params, query, request, set }) => {
    const api = await arenaApi(request);
    return proxyArena(
      api.internal.arena.users({ id: params.id }).channels.get(pagingParams(query)),
      set,
      "user channels",
    );
  },
  {
    params: IdOrSlugParamsSchema,
    query: paginationQuerySchema,
    detail: { description: "Get a user's channels", tags: ["arena"] },
  },
);

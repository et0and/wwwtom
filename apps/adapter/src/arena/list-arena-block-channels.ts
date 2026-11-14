import { Elysia } from "elysia";
import { paginationQuerySchema } from "../schemas";
import { arenaApi, BlockIdParamsSchema, proxyArena, pagingParams } from "./shared";

export const getBlockChannelsRoute = new Elysia().get(
  "/arena/blocks/:id/channels",
  async ({ params, query, request, set }) => {
    const api = await arenaApi(request);
    return proxyArena(
      api.internal.arena.blocks({ id: params.id }).channels.get(pagingParams(query)),
      set,
      "block channels",
    );
  },
  {
    params: BlockIdParamsSchema,
    query: paginationQuerySchema,
    detail: { description: "Get channels a block belongs to", tags: ["arena"] },
  },
);

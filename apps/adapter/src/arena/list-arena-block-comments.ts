import { Elysia } from "elysia";
import { paginationQuerySchema } from "../schemas";
import { arenaApi, BlockIdParamsSchema, proxyArena, pagingParams } from "./shared";

export const getBlockCommentsRoute = new Elysia().get(
  "/arena/blocks/:id/comments",
  async ({ params, query, request, set }) => {
    const api = await arenaApi(request);
    return proxyArena(
      api.internal.arena.blocks({ id: params.id }).comments.get(pagingParams(query)),
      set,
      "block comments",
    );
  },
  {
    params: BlockIdParamsSchema,
    query: paginationQuerySchema,
    detail: { description: "Get block comments", tags: ["arena"] },
  },
);

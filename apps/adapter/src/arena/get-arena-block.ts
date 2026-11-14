import { Elysia } from "elysia";
import { arenaApi, BlockIdParamsSchema, proxyArena } from "./shared";

export const getBlockRoute = new Elysia().get(
  "/arena/blocks/:id",
  async ({ params, request, set }) => {
    const api = await arenaApi(request);
    return proxyArena(api.internal.arena.blocks({ id: params.id }).get(), set, "block");
  },
  {
    params: BlockIdParamsSchema,
    detail: { description: "Get a block", tags: ["arena"] },
  },
);

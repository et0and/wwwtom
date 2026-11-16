import { Elysia } from "elysia";
import { arenaApi, IdOrSlugParamsSchema, proxyArena } from "./shared";

export const getUserRoute = new Elysia().get(
  "/arena/users/:id",
  async ({ params, request, set }) => {
    const api = await arenaApi(request);
    return proxyArena(api.internal.arena.users({ id: params.id }).get(), set, "user");
  },
  {
    params: IdOrSlugParamsSchema,
    detail: { description: "Get a user", tags: ["arena"] },
  },
);

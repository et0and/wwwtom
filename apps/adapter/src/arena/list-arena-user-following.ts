import { Elysia } from "elysia";
import { arenaApi, IdOrSlugParamsSchema, proxyArena } from "./shared";

export const getUserFollowingRoute = new Elysia().get(
  "/arena/users/:id/following",
  async ({ params, request, set }) => {
    const api = await arenaApi(request);
    return proxyArena(
      api.internal.arena.users({ id: params.id }).following.get(),
      set,
      "following",
    );
  },
  {
    params: IdOrSlugParamsSchema,
    detail: { description: "Get a user's following", tags: ["arena"] },
  },
);

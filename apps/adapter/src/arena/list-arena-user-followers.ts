import { Elysia } from "elysia";
import { arenaApi, IdOrSlugParamsSchema, proxyArena } from "./shared";

export const getUserFollowersRoute = new Elysia().get(
  "/arena/users/:id/followers",
  async ({ params, request, set }) => {
    const api = await arenaApi(request);
    return proxyArena(
      api.internal.arena.users({ id: params.id }).followers.get(),
      set,
      "followers",
    );
  },
  {
    params: IdOrSlugParamsSchema,
    detail: { description: "Get a user's followers", tags: ["arena"] },
  },
);

import { Elysia } from "elysia";
import { arenaApi, ChannelSlugParamsSchema, proxyArena } from "./shared";

export const getChannelRoute = new Elysia().get(
  "/arena/channels/:slug",
  async ({ params, request, set }) => {
    const api = await arenaApi(request);
    return proxyArena(api.internal.arena.channels({ slug: params.slug }).get(), set, "channel");
  },
  {
    params: ChannelSlugParamsSchema,
    detail: { description: "Get a channel by slug", tags: ["arena"] },
  },
);

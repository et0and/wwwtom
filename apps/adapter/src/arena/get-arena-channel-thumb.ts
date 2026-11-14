import { Elysia } from "elysia";
import { arenaApi, ChannelSlugParamsSchema, proxyArena } from "./shared";

export const getChannelThumbRoute = new Elysia().get(
  "/arena/channels/:slug/thumb",
  async ({ params, request, set }) => {
    const api = await arenaApi(request);
    return proxyArena(
      api.internal.arena.channels({ slug: params.slug }).thumb.get(),
      set,
      "channel thumb",
    );
  },
  {
    params: ChannelSlugParamsSchema,
    detail: { description: "Get channel thumbnail", tags: ["arena"] },
  },
);

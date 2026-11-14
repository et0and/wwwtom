import { Elysia } from "elysia";
import { paginationQuerySchema } from "../schemas";
import { arenaApi, ChannelSlugParamsSchema, proxyArena, pagingParams } from "./shared";

export const getChannelContentsRoute = new Elysia().get(
  "/arena/channels/:slug/contents",
  async ({ params, query, request, set }) => {
    const api = await arenaApi(request);
    return proxyArena(
      api.internal.arena.channels({ slug: params.slug }).contents.get(pagingParams(query)),
      set,
      "channel contents",
    );
  },
  {
    params: ChannelSlugParamsSchema,
    query: paginationQuerySchema,
    detail: { description: "Get channel contents", tags: ["arena"] },
  },
);

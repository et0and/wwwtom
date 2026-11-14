import { Elysia } from "elysia";
import { Schema } from "effect";
import { arenaApi, ChannelSlugParamsSchema, proxyArena } from "./shared";

const FrameQuerySchema = Schema.toStandardSchemaV1(
  Schema.Struct({
    page: Schema.optional(Schema.FiniteFromString),
    /** Per-boot token: a new value forces a fresh are.na read. */
    t: Schema.optional(Schema.FiniteFromString),
  }),
);

export const getArenaFrameRoute = new Elysia().get(
  "/arena/frame/:slug",
  async ({ params, query, request, set }) => {
    const api = await arenaApi(request);
    return proxyArena(
      api.internal.arena.frame({ slug: params.slug }).get({
        query: { page: query.page, t: query.t },
      }),
      set,
      "frame",
    );
  },
  {
    params: ChannelSlugParamsSchema,
    query: FrameQuerySchema,
    detail: {
      description: "List the image blocks a desk frame can draw for a channel",
      tags: ["arena-frame"],
    },
  },
);

import { Elysia } from "elysia";
import { Schema } from "effect";
import {
  contentsFor,
  entryBlocks,
  masterContents,
  matchesChannelId,
  notFound,
  paginationMeta,
} from "./data";

export const channelContentsRoute = new Elysia().get(
  "/v3/channels/:id/contents",
  ({ params, query }) => {
    const per = query.per ?? 10;
    const page = query.page ?? 1;
    const master = masterContents(params.id);
    if (master) {
      const start = (page - 1) * per;
      return {
        data: master.slice(start, start + per),
        meta: paginationMeta(master.length, per, page),
      };
    }
    const blocks = entryBlocks(params.id);
    if (blocks) {
      return { data: blocks, meta: paginationMeta(blocks.length, per, page) };
    }
    if (!matchesChannelId(params.id)) {
      return notFound;
    }
    const data = contentsFor(params.id);
    if (!data) {
      return notFound;
    }
    return { data, meta: paginationMeta(data.length, per, page) };
  },
  {
    params: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.String })),
    query: Schema.toStandardSchemaV1(
      Schema.Struct({
        page: Schema.optional(Schema.FiniteFromString),
        per: Schema.optional(Schema.FiniteFromString),
        sort: Schema.optional(Schema.String),
        user_id: Schema.optional(Schema.FiniteFromString),
      }),
    ),
    detail: { description: "Simulated Are.na channel contents", tags: ["arena"] },
  },
);

import { Elysia } from "elysia";
import { Schema } from "effect";
import { channel, imageBlock, paginationMeta, textBlock, user } from "./data";

export const searchRoute = new Elysia().get(
  "/v3/search",
  ({ query }) => {
    const per = query.per ?? 20;
    const data: unknown[] = [textBlock, imageBlock, channel, user];
    return { data, meta: paginationMeta(data.length, per, query.page ?? 1) };
  },
  {
    query: Schema.toStandardSchemaV1(
      Schema.Struct({
        query: Schema.optional(Schema.String),
        type: Schema.optional(Schema.Union([Schema.String, Schema.Array(Schema.String)])),
        scope: Schema.optional(Schema.String),
        user_id: Schema.optional(Schema.FiniteFromString),
        group_id: Schema.optional(Schema.FiniteFromString),
        channel_id: Schema.optional(Schema.FiniteFromString),
        ext: Schema.optional(Schema.Union([Schema.String, Schema.Array(Schema.String)])),
        sort: Schema.optional(Schema.String),
        seed: Schema.optional(Schema.FiniteFromString),
        page: Schema.optional(Schema.FiniteFromString),
        per: Schema.optional(Schema.FiniteFromString),
      }),
    ),
    detail: { description: "Simulated Are.na search", tags: ["arena"] },
  },
);

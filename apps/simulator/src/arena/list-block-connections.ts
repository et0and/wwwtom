import { Elysia } from "elysia";
import { Schema } from "effect";
import { channel, paginationMeta } from "./data";

export const blockConnectionsRoute = new Elysia().get(
  "/v3/blocks/:id/connections",
  ({ query }) => {
    const per = query.per ?? 20;
    const data = [channel];
    return { data, meta: paginationMeta(data.length, per, query.page ?? 1) };
  },
  {
    params: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.Finite })),
    query: Schema.toStandardSchemaV1(
      Schema.Struct({
        page: Schema.optional(Schema.FiniteFromString),
        per: Schema.optional(Schema.FiniteFromString),
        sort: Schema.optional(Schema.String),
      }),
    ),
    detail: { description: "Simulated Are.na block connections", tags: ["arena"] },
  },
);

import { Elysia } from "elysia";
import { Schema } from "effect";
import { comment, notFound, paginationMeta, textBlock } from "./data";

export const blockCommentsRoute = new Elysia().get(
  "/v3/blocks/:id/comments",
  ({ params, query }) => {
    if (params.id !== textBlock.id) {
      return notFound;
    }
    const per = query.per ?? 20;
    const data = [comment];
    return { data, meta: paginationMeta(data.length, per, query.page ?? 1) };
  },
  {
    params: Schema.toStandardSchemaV1(Schema.Struct({ id: Schema.Finite })),
    query: Schema.toStandardSchemaV1(
      Schema.Struct({
        page: Schema.optional(Schema.FiniteFromString),
        per: Schema.optional(Schema.FiniteFromString),
      }),
    ),
    detail: { description: "Simulated Are.na block comments", tags: ["arena"] },
  },
);

import { Schema } from "effect";

export const ListResponseSchema = <A, I, R>(itemSchema: Schema.Codec<A, I, R>) =>
  Schema.Struct({
    docs: Schema.Array(itemSchema),
    totalDocs: Schema.Finite,
    limit: Schema.Finite,
    page: Schema.Finite,
    totalPages: Schema.Finite,
    hasNextPage: Schema.Boolean,
    hasPrevPage: Schema.Boolean,
  });

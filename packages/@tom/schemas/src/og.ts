import { Schema } from "effect";

export const ogImageQueryParamsSchema = Schema.standardSchemaV1(
  Schema.Struct({
    title: Schema.optional(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(100))),
    summary: Schema.optional(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(200))),
  }),
);

export const ogImageResponseSchema = Schema.standardSchemaV1(
  Schema.Struct({
    success: Schema.Literal(true),
    generatedAt: Schema.Number,
  }),
);

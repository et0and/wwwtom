import { Schema } from "effect";

const OgImageQueryParamsSchema = Schema.Struct({
  title: Schema.optional(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100))),
  summary: Schema.optional(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200))),
});

export const ogImageQueryParamsSchema = OgImageQueryParamsSchema;

const OgImageResponseSchema = Schema.Struct({
  success: Schema.Literal(true),
  generatedAt: Schema.Number,
});

export const ogImageResponseSchema = OgImageResponseSchema;

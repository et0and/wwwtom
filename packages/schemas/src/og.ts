import { Schema } from "effect";

export const ogTemplateSchema = Schema.Literals(["default", "minimal", "developer", "sophie"]);
export type OgTemplate = typeof ogTemplateSchema.Type;

const OgImageQueryParamsSchema = Schema.Struct({
  title: Schema.optional(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100))),
  summary: Schema.optional(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200))),
  date: Schema.optional(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(30))),
  template: Schema.optional(ogTemplateSchema),
});

export const ogImageQueryParamsSchema = OgImageQueryParamsSchema;

const OgImageResponseSchema = Schema.Struct({
  success: Schema.Literal(true),
  generatedAt: Schema.Number,
});

export const ogImageResponseSchema = OgImageResponseSchema;

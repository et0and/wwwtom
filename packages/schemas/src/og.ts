import { Schema } from "effect";

export const OgTemplateSchema = Schema.Literals(["default", "minimal", "sophie"]);
export type OgTemplate = typeof OgTemplateSchema.Type;

export const OgImageQueryParamsSchema = Schema.Struct({
  title: Schema.optional(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100))),
  summary: Schema.optional(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200))),
  date: Schema.optional(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(30))),
  template: Schema.optional(OgTemplateSchema),
});

/**
 * OG text params are free text — titles and summaries legitimately contain
 * commas. Elysia's standard-schema query parser splits comma-separated
 * values into arrays, so accept the array form and rejoin it in the handler
 * (validateOgParams enforces the real length bounds on the joined value).
 */
export const commaTolerantString = (maxLength: number) =>
  Schema.Union([
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(maxLength)),
    // Rejoined in the handler; validateOgParams enforces the real bounds on
    // the full joined value. Bounded (10 items of 300 chars) so repeated
    // params cannot pile up unbounded memory before the join.
    Schema.Array(Schema.String.pipe(Schema.check(Schema.isMaxLength(300)))).pipe(
      Schema.check(Schema.isMaxLength(10)),
    ),
  ]);

/** Rejoin the comma-split list form Elysia produces for text params. */
export const joinCommaList = (
  value: string | ReadonlyArray<string> | undefined,
): string | undefined => {
  if (value === undefined) return undefined;
  if (Schema.is(Schema.String)(value)) return value;
  return value.join(",");
};

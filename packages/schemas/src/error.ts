import { Schema } from "effect";

/** A single field-level problem, per the RFC 9457 validation extension. */
const ProblemErrorSchema = Schema.Struct({
  detail: Schema.String,
  pointer: Schema.optional(Schema.String),
});

/**
 * RFC 9457 problem details object, serialized as
 * `application/problem+json` (rfc9457 §3). `type` is a URI identifying the
 * problem; `errors` carries field-level validation problems as an extension.
 */
const ProblemDetailsSchema = Schema.Struct({
  type: Schema.String,
  status: Schema.Number,
  title: Schema.String,
  detail: Schema.optional(Schema.String),
  instance: Schema.optional(Schema.String),
  errors: Schema.optional(Schema.Array(ProblemErrorSchema)),
});

export const problemDetailsSchema = ProblemDetailsSchema;

export type ProblemDetails = Schema.Schema.Type<typeof ProblemDetailsSchema>;

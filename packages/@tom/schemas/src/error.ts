import { Schema } from "effect";

const ErrorResponseSchema = Schema.Struct({
  error: Schema.String,
  cause: Schema.optional(Schema.String),
});

export const errorResponseSchema = ErrorResponseSchema;

export type ErrorResponse = Schema.Schema.Type<typeof ErrorResponseSchema>;

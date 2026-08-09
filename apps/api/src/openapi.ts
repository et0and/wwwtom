import { Schema } from "effect";
import type { StandardSchemaV1 } from "@standard-schema/spec";

export type OpenApiSchema = StandardSchemaV1 & {
  readonly "~standard": StandardSchemaV1["~standard"] & {
    readonly jsonSchema: {
      readonly input: () => unknown;
      readonly output: () => unknown;
    };
  };
};

/**
 * Wrap an Effect schema as a standard schema that also exposes JSON Schema,
 * so @elysiajs/openapi can render parameters, responses, and components.
 * Without the jsonSchema getters the plugin silently skips the schema.
 */
export const toOpenApiSchema = <const S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
): OpenApiSchema => {
  const jsonSchema = () => Schema.toJsonSchemaDocument(schema).schema;
  const standard = Schema.toStandardSchemaV1(schema);
  return {
    ...standard,
    "~standard": {
      ...standard["~standard"],
      jsonSchema: { input: jsonSchema, output: jsonSchema },
    },
  };
};

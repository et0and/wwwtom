import { describe, expect, it } from "vitest";
import { Schema } from "effect";
import { toOpenApiSchema } from "../openapi";

describe("toOpenApiSchema", () => {
  it("wraps an Effect schema with jsonSchema getters", () => {
    const schema = Schema.String.pipe(Schema.annotate({ description: "test" }));
    const wrapped = toOpenApiSchema(schema);
    expect(wrapped["~standard"]).toBeDefined();
    const jsonSchema = wrapped["~standard"].jsonSchema;
    expect(jsonSchema.input).toBeTypeOf("function");
    expect(jsonSchema.output).toBeTypeOf("function");
    expect(jsonSchema.input()).toBeDefined();
    expect(jsonSchema.output()).toBeDefined();
  });

  it("preserves standard schema validation", async () => {
    const schema = Schema.Struct({ name: Schema.String });
    const wrapped = toOpenApiSchema(schema);
    const result = await wrapped["~standard"].validate({ name: "ok" });
    expect(result.issues).toBeUndefined();
    const invalid = await wrapped["~standard"].validate({ name: 123 });
    expect(invalid.issues).toBeDefined();
  });
});

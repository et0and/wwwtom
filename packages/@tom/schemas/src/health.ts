import { Schema } from "effect";

const HealthStatus = Schema.Union(
  Schema.Literal("healthy"),
  Schema.Literal("unhealthy"),
  Schema.Literal("degraded"),
);

export const healthResponseSchema = Schema.standardSchemaV1(
  Schema.Struct({
    status: HealthStatus,
    timestamp: Schema.Number,
  }),
);

import { Schema } from "effect";

const HealthStatus = Schema.Union([
  Schema.Literal("healthy"),
  Schema.Literal("unhealthy"),
  Schema.Literal("degraded"),
]);

const HealthResponseSchema = Schema.Struct({
  status: HealthStatus,
  timestamp: Schema.Finite,
});

export const healthResponseSchema = HealthResponseSchema;

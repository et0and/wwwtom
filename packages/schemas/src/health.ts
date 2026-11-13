import { Schema } from "effect";

/**
 * The health route only ever reports `healthy`: it proves the worker is
 * running, not that its dependencies are. A `degraded`/`unhealthy` status
 * would be a promise nothing keeps.
 */
export const healthResponseSchema = Schema.Struct({
  status: Schema.Literal("healthy"),
  timestamp: Schema.Finite,
});

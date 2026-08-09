import { Elysia } from "elysia";
import { healthResponseSchema } from "@tom/schemas/health";
import { Schema } from "effect";

export const healthRoutes = new Elysia().get(
  "/health",
  () => ({ status: "healthy" as const, timestamp: Date.now() }),
  {
    response: { 200: Schema.toStandardSchemaV1(healthResponseSchema) },
    detail: {
      description: "Health check endpoint",
      tags: ["system"],
    },
  },
);

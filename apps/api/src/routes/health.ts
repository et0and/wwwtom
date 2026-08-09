import { Elysia } from "elysia";
import { Schema } from "effect";
import { healthResponseSchema } from "@tom/schemas/health";
import { toOpenApiSchema } from "../openapi";

export const healthRoutes = new Elysia().get(
  "/health",
  () => ({ status: "healthy" as const, timestamp: Date.now() }),
  {
    response: {
      200: toOpenApiSchema(
        healthResponseSchema.pipe(Schema.annotate({ description: "Service is healthy" })),
      ),
    },
    detail: {
      description: "Health check endpoint",
      tags: ["system"],
    },
  },
);

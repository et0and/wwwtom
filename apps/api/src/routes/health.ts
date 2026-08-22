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
        // Stryker disable next-line ObjectLiteral: OpenAPI annotation — mutant replaces with empty object
        healthResponseSchema.pipe(Schema.annotate({ description: "Service is healthy" })),
      ),
    },
    // Stryker disable next-line ObjectLiteral: OpenAPI detail — type-level
    detail: {
      description: "Health check endpoint",
      // Stryker disable next-line ArrayDeclaration: OpenAPI tag — mutant replaces with empty array
      tags: ["system"],
    },
  },
);

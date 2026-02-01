import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { healthResponseSchema } from "@tom/schemas";
import type { Env } from "../config/effect";

export const healthRoutes = new Hono<{ Bindings: Env }>();

healthRoutes.get(
  "/",
  describeRoute({
    description: "Health check endpoint",
    responses: {
      200: {
        description: "Service is healthy",
        content: {
          "application/json": { schema: resolver(healthResponseSchema) },
        },
      },
    },
  }),
  (c) => {
    return c.json({ status: "healthy", timestamp: Date.now() });
  },
);

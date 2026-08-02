import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
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
          "application/json": {
            schema: {
              type: "object",
              required: ["status", "timestamp"],
              properties: {
                status: {
                  type: "string",
                  enum: ["healthy", "unhealthy", "degraded"],
                },
                timestamp: { type: "number" },
              },
            },
          },
        },
      },
    },
  }),
  (c) => {
    return c.json({ status: "healthy", timestamp: Date.now() });
  },
);

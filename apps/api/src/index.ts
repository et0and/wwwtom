import { Hono } from "hono";
import { Scalar } from "@scalar/hono-api-reference";
import { describeRoute, openAPIRouteHandler, resolver } from "hono-openapi";
import { Schema } from "effect";

const app = new Hono();

const responseSchema = Schema.standardSchemaV1(
  Schema.Struct({
    status: Schema.Literal("healthy"),
    timestamp: Schema.Number,
  }),
);

app.get(
  "/health",
  describeRoute({
    description: "Health check endpoint",
    responses: {
      200: {
        description: "Service is healthy",
        content: {
          "application/json": { schema: resolver(responseSchema) },
        },
      },
    },
  }),
  (c) => {
    return c.json({ status: "healthy", timestamp: Date.now() });
  },
);

app.get(
  "/openapi",
  openAPIRouteHandler(app, {
    documentation: {
      info: {
        title: "Schools API",
        version: "0.0.1",
        description: "A school directory API service",
        summary:
          "Mirrors data from data.govt.nz, cached and served at the edge thanks to Cloudflare",
      },
      servers: [
        { url: "https://schools.api.tom.so", description: "Production API service" },
        { url: "https://staging.schools.api.tom.so", description: "Staging API service, pre-prod" },
        { url: "https://dev.schools.api.tom.so", description: "Development API service, unstable" },
      ],
    },
  }),
);

app.get("/", Scalar({ url: "/openapi", theme: "elysiajs", pageTitle: "Schools API" }));

export default app;

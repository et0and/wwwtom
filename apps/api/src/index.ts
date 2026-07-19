import { Hono } from "hono";
import { cors } from "hono/cors";
import { Scalar } from "@scalar/hono-api-reference";
import { openAPIRouteHandler } from "hono-openapi";
import { Effect } from "effect";
import { requestId } from "hono/request-id";
import { HttpStatus } from "@tom/constants";
import { healthRoutes } from "./routes/health";
import { ogRoutes } from "./routes/og";
import { productRoutes } from "./routes/products";
import { polarRoutes } from "./routes/polar";
import { resolveEnv, sendErrorAlert, type Env } from "./config/effect";

const app = new Hono<{ Bindings: Env }>();

app.use("*", requestId());
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000", "https://tom.so"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  }),
);

app.onError(async (error, c) => {
  console.error("Unhandled API error", error);
  void resolveEnv(c.env)
    .then((env) => sendErrorAlert(env, "Unhandled API error", error))
    .catch((alertError) => console.error("Failed to send API error alert", alertError));
  return c.json({ error: "Internal server error" }, HttpStatus.InternalServerError);
});

app.route("/health", healthRoutes);
app.route("/og", ogRoutes);
app.route("/products", productRoutes);
app.route("/customers", productRoutes);
app.route("/checkout", polarRoutes);
app.route("/portal", polarRoutes);

app.get(
  "/openapi",
  openAPIRouteHandler(app, {
    documentation: {
      info: {
        title: "Tom API",
        version: "0.0.1",
        description: "A multi faceted API service",
      },
      servers: [
        {
          url: "https://api.tom.so",
          description: "Production API service",
        },
        {
          url: "https://staging.api.tom.so",
          description: "Staging API service, pre-prod",
        },
        {
          url: "https://dev.api.tom.so",
          description: "Development API service, unstable",
        },
      ],
    },
  }),
);

app.get(
  "/",
  Scalar({
    url: "/openapi",
    theme: "elysiajs",
    pageTitle: "Tom API",
    favicon: "https://tom.so/favicon.ico",
  }),
);

export default app;

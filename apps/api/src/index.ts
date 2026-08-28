import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { openapi } from "@elysiajs/openapi";
import { Effect } from "effect";
import { otelConfigFromEnv, logLevelFromEnv } from "@tom/utils/services/logging";
import {
  attachRequestContext,
  attachRequestEnv,
  getRequestEnv,
  sendErrorAlert,
  toErrorResponse,
} from "@tom/utils/services/worker";
import type { CloudflareEnv } from "@tom/utils/services/config";
import { healthRoutes } from "./routes/health";
import { requireInternalTokenBeforeHandle } from "./internal";
import { INTERNAL_TOKEN_HEADER } from "@tom/constants/headers";
import { ogRoutes } from "./routes/og";
import { polarRoutes } from "./routes/polar";

// Stryker disable next-line ObjectLiteral: auto
// Stryker disable all: api wiring — framework config
export const app = new Elysia({
  adapter: CloudflareAdapter,
  name: "tom-api",
})
  .use(
    openapi({
      path: "/",
      specPath: "/openapi.json",
      documentation: {
        info: {
          title: "Tom API",
          version: "1.1.0",
          description: "A multi faceted API service",
        },
        servers: [
          // Stryker disable next-line ObjectLiteral: OpenAPI server — annotation
          { url: "https://api.tom.so", description: "Production API service" },
          // Stryker disable next-line ObjectLiteral: OpenAPI server — annotation
          { url: "https://staging-api.tom.so", description: "Staging API service, pre-prod" },
          // Stryker disable next-line ObjectLiteral: OpenAPI server — annotation
          { url: "https://dev-api.tom.so", description: "Development API service, unstable" },
        ],
        components: {
          securitySchemes: {
            InternalToken: {
              type: "apiKey",
              in: "header",
              name: INTERNAL_TOKEN_HEADER,
              description: "Shared secret the adapter presents to the API's protected routes",
            },
          },
        },
      },
    }),
  )
  // Stryker disable next-line all: derive env — framework wiring
  .derive(({ request }) => ({ env: getRequestEnv(request) }))
  .onRequest(async ({ set, request }) => {
    const requestId = crypto.randomUUID();
    set.headers["x-request-id"] = requestId;
    const env = getRequestEnv(request);
    const otel = await otelConfigFromEnv(env);
    // Stryker disable next-line all: request context
    attachRequestContext(request, {
      requestId,
      logLevel: logLevelFromEnv(env),
      // Stryker disable next-line ConditionalExpression,LogicalOperator,ObjectLiteral: optional otel
      ...(otel && { otel }),
    });
  })
  .onError(({ code, error, set, request }) => {
    set.headers["content-type"] = "application/json";
    // Stryker disable next-line ConditionalExpression: NOT_FOUND branch
    if (code === "NOT_FOUND") {
      // Stryker disable next-line all: logging context
      Effect.runFork(Effect.logWarning("Not found", { path: request.url }));
      return toErrorResponse(404, "Not found");
    }
    // Stryker disable next-line ConditionalExpression: VALIDATION branch
    if (code === "VALIDATION") {
      // Stryker disable next-line all: logging context
      Effect.runFork(Effect.logWarning("Validation error", { path: request.url }));
      return toErrorResponse(400, "Validation error");
    }
    // Stryker disable next-line CallExpression: auto
    Effect.runFork(
      // Stryker disable next-line BlockStatement: error alert side-effect
      Effect.sync(() => {
        void sendErrorAlert(getRequestEnv(request), "Unhandled API error", error);
      }),
    );
    // Stryker disable next-line ConditionalExpression: onError fallback
    return toErrorResponse(500, "Internal server error");
  })
  .use(healthRoutes)
  // OG image generation is a public route: social crawlers (Twitter, Slack,
  // iMessage) fetch the image URL without any auth headers.
  .use(ogRoutes)
  // Stryker disable next-line all: route guard — framework wiring
  .guard({ beforeHandle: requireInternalTokenBeforeHandle }, (app) => app.use(polarRoutes))
  .compile();

export type ApiApp = typeof app;

// Stryker disable next-line all: worker export
const worker = {
  // Stryker disable next-line ArrowFunction: auto
  fetch: (request: Request, env: CloudflareEnv) => app.fetch(attachRequestEnv(request, env)),
};

export default worker;
// Stryker restore all

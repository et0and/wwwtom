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
import { queueHandler, type MessageBatch } from "./services/queue-consumer";

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
          { url: "https://api.tom.so", description: "Production API service" },
          { url: "https://staging-api.tom.so", description: "Staging API service, pre-prod" },
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
  .derive(({ request }) => ({ env: getRequestEnv(request) }))
  .onRequest(async ({ set, request }) => {
    const requestId = crypto.randomUUID();
    set.headers["x-request-id"] = requestId;
    const env = getRequestEnv(request);
    const otel = await otelConfigFromEnv(env);
    attachRequestContext(request, {
      requestId,
      logLevel: logLevelFromEnv(env),
      ...(otel && { otel }),
    });
  })
  .onError(({ code, error, set, request }) => {
    set.headers["content-type"] = "application/json";
    if (code === "NOT_FOUND") {
      Effect.runFork(Effect.logWarning("Not found", { path: request.url }));
      return toErrorResponse(404, "Not found");
    }
    if (code === "VALIDATION") {
      Effect.runFork(Effect.logWarning("Validation error", { path: request.url }));
      return toErrorResponse(400, "Validation error");
    }
    Effect.runFork(
      Effect.sync(() => {
        void sendErrorAlert(getRequestEnv(request), "Unhandled API error", error);
      }),
    );
    return toErrorResponse(500, "Internal server error");
  })
  .use(healthRoutes)
  // OG image generation is a public route: social crawlers (Twitter, Slack,
  // iMessage) fetch the image URL without any auth headers.
  .use(ogRoutes)
  .guard({ beforeHandle: requireInternalTokenBeforeHandle }, (app) => app.use(polarRoutes))
  .compile();

export type ApiApp = typeof app;

const worker = {
  fetch: (request: Request, env: CloudflareEnv) => app.fetch(attachRequestEnv(request, env)),
  queue: (batch: MessageBatch, env: CloudflareEnv) => queueHandler(batch, env),
};

export default worker;

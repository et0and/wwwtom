import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { openapi } from "@elysiajs/openapi";
import { Effect, Schema } from "effect";
import { CmsError } from "@tom/types/errors";
import { otelConfigFromEnv, logLevelFromEnv } from "@tom/utils/services/logging";
import {
  attachRequestContext,
  attachRequestEnv,
  errorDetailsFromRequest,
  getRequestEnv,
  problemTypeForStatus,
  sendErrorAlert,
  toProblemResponse,
  toValidationProblems,
} from "@tom/utils/services/worker";
import type { CloudflareEnv } from "@tom/utils/services/config";
import { HttpStatus } from "@tom/constants/http";
import { ProblemType } from "@tom/constants/problem";
import { healthRoutes } from "./routes/health";
import { requireInternalTokenBeforeHandle } from "./internal";
import { authRoutes } from "./routes/auth";
import { cmsRoutes } from "./routes/cms";
import { cmsWriteRoutes } from "./routes/cms-writes";
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
  .onError(({ code, error, request }) => {
    Effect.runFork(Effect.logError("API error", { code, cause: String(error) }));
    if (Schema.is(CmsError)(error)) {
      const isKnownClientError =
        error.status === HttpStatus.BadRequest ||
        error.status === HttpStatus.Unauthorized ||
        error.status === HttpStatus.Forbidden ||
        error.status === HttpStatus.NotFound ||
        error.status === HttpStatus.Conflict ||
        error.status === HttpStatus.PayloadTooLarge;
      if (isKnownClientError) {
        Effect.runFork(
          Effect.logWarning("CMS client error", { path: request.url, status: error.status }),
        );
        const type = problemTypeForStatus(error.status);
        return toProblemResponse(error.status, error.message, {
          ...(type && { type }),
          instance: request.url,
        });
      }
      void sendErrorAlert(
        getRequestEnv(request),
        "CMS request failed",
        error,
        errorDetailsFromRequest(request, { service: "tom-api", status: error.status }),
      );
      return toProblemResponse(HttpStatus.InternalServerError, "Internal server error");
    }
    if (code === "NOT_FOUND") {
      Effect.runFork(Effect.logWarning("Not found", { path: request.url }));
      return toProblemResponse(HttpStatus.NotFound, "Not found", {
        type: ProblemType.NotFound,
        instance: request.url,
      });
    }
    if (code === "VALIDATION") {
      Effect.runFork(Effect.logWarning("Validation error", { path: request.url }));
      const errors = toValidationProblems(error);
      return toProblemResponse(HttpStatus.BadRequest, "Validation error", {
        type: ProblemType.Validation,
        instance: request.url,
        ...(errors && { errors }),
      });
    }
    void sendErrorAlert(
      getRequestEnv(request),
      "Unhandled API error",
      error,
      errorDetailsFromRequest(request, { service: "tom-api", status: 500 }),
    );
    return toProblemResponse(HttpStatus.InternalServerError, "Internal server error");
  })
  .use(healthRoutes)
  .use(cmsRoutes)
  // OG image generation is a public route: social crawlers (Twitter, Slack,
  // iMessage) fetch the image URL without any auth headers.
  .use(ogRoutes)
  .guard({ beforeHandle: requireInternalTokenBeforeHandle }, (app) =>
    app.use(polarRoutes).use(authRoutes).use(cmsWriteRoutes),
  )
  .compile();

export type ApiApp = typeof app;

const worker = {
  fetch: (request: Request, env: CloudflareEnv) => app.fetch(attachRequestEnv(request, env)),
  queue: (batch: MessageBatch, env: CloudflareEnv) => queueHandler(batch, env),
};

export default worker;

import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { openapi } from "@elysiajs/openapi";
import { Effect } from "effect";
import {
  attachRequestEnv,
  getRequestEnv,
  sendErrorAlert,
  toErrorResponse,
} from "@tom/utils/services/worker";
import type { CloudflareEnv } from "@tom/utils/services/config";
import { healthRoutes } from "./routes/health";
import { ogRoutes } from "./routes/og";
import { polarRoutes } from "./routes/polar";

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
          description: "tom.so domain API — health, OG image generation, Polar checkout",
        },
      },
    }),
  )
  .derive(({ request }) => ({ env: getRequestEnv(request) }))
  .onRequest(({ set }) => {
    set.headers["x-request-id"] = crypto.randomUUID();
  })
  .onError(({ code, error, set, request }) => {
    set.headers["content-type"] = "application/json";
    Effect.runFork(
      Effect.sync(() => {
        void sendErrorAlert(getRequestEnv(request), "Unhandled API error", error);
      }),
    );
    if (code === "NOT_FOUND") {
      return toErrorResponse(404, "Not found");
    }
    if (code === "VALIDATION") {
      return toErrorResponse(400, "Validation error");
    }
    return toErrorResponse(500, "Internal server error");
  })
  .use(healthRoutes)
  .use(ogRoutes)
  .use(polarRoutes)
  .compile();

export type ApiApp = typeof app;

const worker = {
  fetch: (request: Request, env: CloudflareEnv) => app.fetch(attachRequestEnv(request, env)),
};

export default worker;

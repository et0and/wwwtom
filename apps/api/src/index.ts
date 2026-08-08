import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { Effect } from "effect";
import { healthRoutes } from "./routes/health";
import { ogRoutes } from "./routes/og";
import { polarRoutes } from "./routes/polar";
import {
  getRequestEnv,
  sendErrorAlert,
  toJsonResponse,
  type Env,
  type RequestWithEnv,
} from "./config/effect";

export const app = new Elysia({
  adapter: CloudflareAdapter,
  name: "tom-api",
})
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
      return toJsonResponse(404, { error: "Not found" });
    }
    if (code === "VALIDATION") {
      return toJsonResponse(400, { error: "Validation error" });
    }
    return toJsonResponse(500, { error: "Internal server error" });
  })
  .use(healthRoutes)
  .use(ogRoutes)
  .use(polarRoutes)
  .compile();

export type ApiApp = typeof app;

const worker = {
  fetch: (request: Request, env: Env) => {
    (request as RequestWithEnv).env = env;
    return app.fetch(request);
  },
};

export default worker;

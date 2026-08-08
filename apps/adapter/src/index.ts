import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { cors } from "@elysiajs/cors";
import { arenaIntegration } from "./integrations/arena";
import { payloadIntegration } from "./integrations/payload";
import { polarIntegration } from "./integrations/polar";
import { guestbookIntegration } from "./integrations/guestbook";
import { githubIntegration } from "./integrations/github";
import { imageIntegration } from "./integrations/image";
import { ogIntegration } from "./integrations/og";
import {
  AdapterError,
  getRequestEnv,
  sendErrorAlert,
  toJsonResponse,
  type AdapterEnv,
  type RequestWithEnv,
} from "./config/effect";

export const app = new Elysia({
  adapter: CloudflareAdapter,
  name: "tom-adapter",
})
  .use(
    cors({
      origin: (request) => {
        const origin = request.headers.get("origin");
        if (!origin) return false;
        return (
          origin === "http://localhost:5173" ||
          origin === "http://localhost:3000" ||
          origin === "https://tom.so" ||
          origin.endsWith(".tom.so")
        );
      },
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
    }),
  )
  .onRequest(({ set }) => {
    set.headers["x-request-id"] = crypto.randomUUID();
  })
  .onError(({ code, error, set, request }) => {
    set.headers["content-type"] = "application/json";
    if (error instanceof AdapterError) {
      return toJsonResponse(error.status, { error: error.message });
    }
    sendErrorAlert(getRequestEnv(request), "Unhandled adapter error", error);
    if (code === "NOT_FOUND") {
      return toJsonResponse(404, { error: "Not found" });
    }
    if (code === "VALIDATION") {
      return toJsonResponse(400, { error: "Validation error" });
    }
    return toJsonResponse(500, { error: "Internal server error" });
  })
  .use(arenaIntegration)
  .use(payloadIntegration)
  .use(polarIntegration)
  .use(guestbookIntegration)
  .use(githubIntegration)
  .use(imageIntegration)
  .use(ogIntegration)
  .compile();

export type AdapterApp = typeof app;

const worker = {
  fetch: (request: Request, env: AdapterEnv) => {
    (request as RequestWithEnv).env = env;
    return app.fetch(request);
  },
};

export default worker;

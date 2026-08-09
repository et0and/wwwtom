import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { cors } from "@elysiajs/cors";
import {
  attachRequestEnv,
  getRequestEnv,
  sendErrorAlert,
  toErrorResponse,
} from "@tom/utils/services/worker";
import type { CloudflareEnv } from "@tom/utils/services/config";
import { AdapterError } from "./config/effect";
import { arenaIntegration } from "./integrations/arena";
import { payloadIntegration } from "./integrations/payload";
import { polarIntegration } from "./integrations/polar";
import { guestbookIntegration } from "./integrations/guestbook";
import { githubIntegration } from "./integrations/github";
import { imageIntegration } from "./integrations/image";
import { ogIntegration } from "./integrations/og";

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
      return toErrorResponse(error.status, error.message);
    }
    sendErrorAlert(getRequestEnv(request), "Unhandled adapter error", error);
    if (code === "NOT_FOUND") {
      return toErrorResponse(404, "Not found");
    }
    if (code === "VALIDATION") {
      return toErrorResponse(400, "Validation error");
    }
    return toErrorResponse(500, "Internal server error");
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
  fetch: (request: Request, env: CloudflareEnv) => app.fetch(attachRequestEnv(request, env)),
};

export default worker;

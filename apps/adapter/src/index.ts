import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { cors } from "@elysiajs/cors";
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
import { AdapterError } from "./config/effect";
import { arenaIntegration } from "./integrations/arena";
import { payloadIntegration } from "./integrations/payload";
import { polarIntegration } from "./integrations/polar";
import { guestbookIntegration, readUserIdFromCookie } from "./integrations/guestbook";
import { githubIntegration } from "./integrations/github";
import { imageIntegration } from "./integrations/image";
import { ogIntegration } from "./integrations/og";

const VISITOR_SESSION_MAX_AGE = 60 * 60 * 24 * 90;

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
  .derive(async ({ set, request, cookie }) => {
    const requestId = crypto.randomUUID();
    set.headers["x-request-id"] = requestId;
    const env = getRequestEnv(request);

    const sessionCookie = cookie.tom_session?.value;
    const visitorId = typeof sessionCookie === "string" ? sessionCookie : crypto.randomUUID();
    if (typeof sessionCookie !== "string") {
      cookie.tom_session?.set({
        value: visitorId,
        maxAge: VISITOR_SESSION_MAX_AGE,
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
    }

    const guestbookSession = cookie.guestbook_session?.value;
    const userId = readUserIdFromCookie(cookie.guestbook_user?.value);
    const otel = await otelConfigFromEnv(env);
    attachRequestContext(request, {
      requestId,
      sessionId: typeof guestbookSession === "string" ? guestbookSession : visitorId,
      ...(userId ? { userId } : {}),
      logLevel: logLevelFromEnv(env),
      ...(otel ? { otel } : {}),
    });
  })
  .onError(({ code, error, set, request }) => {
    set.headers["content-type"] = "application/json";
    if (error instanceof AdapterError) {
      return toErrorResponse(error.status, error.message);
    }
    if (code === "NOT_FOUND") {
      Effect.runFork(Effect.logWarning("Not found", { path: request.url }));
      return toErrorResponse(404, "Not found");
    }
    if (code === "VALIDATION") {
      Effect.runFork(Effect.logWarning("Validation error", { path: request.url }));
      return toErrorResponse(400, "Validation error");
    }
    sendErrorAlert(getRequestEnv(request), "Unhandled adapter error", error);
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

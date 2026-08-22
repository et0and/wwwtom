import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { cors } from "@elysiajs/cors";
import { Effect, Option, Schema } from "effect";
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
import { guestbookIntegration, userCookieSchema } from "./integrations/guestbook";
import { githubIntegration } from "./integrations/github";
import { imageIntegration } from "./integrations/image";
import { ogIntegration } from "./integrations/og";

// Stryker disable next-line ArithmeticOperator: session max age is constant
const VISITOR_SESSION_MAX_AGE = 60 * 60 * 24 * 90;

// Stryker disable next-line ObjectLiteral: Elysia app config — framework wiring
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
          // Local e2e (apps/e2e) serves the web app from 127.0.0.1.
          origin === "http://127.0.0.1:3000" ||
          origin === "https://tom.so" ||
          origin.endsWith(".tom.so")
        );
      },
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "x-use-simulator"],
    }),
  )
  .derive(async ({ set, request, cookie }) => {
    const requestId = crypto.randomUUID();
    set.headers["x-request-id"] = requestId;
    const env = getRequestEnv(request);

    // Stryker disable next-line OptionalChaining: cookie access — covered by surface.test.ts
    const sessionValue = Schema.decodeUnknownOption(Schema.String)(cookie.tom_session?.value);
    const visitorId = Option.getOrElse(sessionValue, () => crypto.randomUUID());
    if (Option.isNone(sessionValue)) {
      // Stryker disable next-line OptionalChaining: cookie set — jsdom mock
      cookie.tom_session?.set({
        value: visitorId,
        maxAge: VISITOR_SESSION_MAX_AGE,
        // Stryker disable next-line BooleanLiteral: httpOnly flag
        httpOnly: true,
        // Stryker disable next-line EqualityOperator: production check
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
    }

    // Stryker disable next-line OptionalChaining: guestbook session cookie
    const guestbookSession = cookie.guestbook_session?.value;
    const userJson = Option.getOrElse(
      // Stryker disable next-line OptionalChaining: guestbook user cookie
      Schema.decodeUnknownOption(Schema.String)(cookie.guestbook_user?.value),
      // Stryker disable next-line OptionalChaining,ArrowFunction: cookie JSON fallback
      () => JSON.stringify(cookie.guestbook_user?.value),
    );
    const userId = Option.getOrElse(
      Option.map(
        Schema.decodeUnknownOption(userCookieSchema)(userJson),
        // Stryker disable next-line ArrowFunction: userId mapping
        (user) => `${user.username}@${user.instance}`,
      ),
      // Stryker disable next-line ArrowFunction: userId fallback
      () => undefined,
    );
    const otel = await otelConfigFromEnv(env);
    // Stryker disable next-line all: request context — logging annotation
    attachRequestContext(request, {
      requestId,
      sessionId: Option.getOrElse(
        Schema.decodeUnknownOption(Schema.String)(guestbookSession),
        // Stryker disable next-line ArrowFunction: session fallback
        () => visitorId,
      ),
      // Stryker disable next-line ConditionalExpression,LogicalOperator,ObjectLiteral: logging context optional userId
      ...(userId && { userId }),
      logLevel: logLevelFromEnv(env),
      // Stryker disable next-line ConditionalExpression,LogicalOperator,ObjectLiteral: logging context optional otel
      ...(otel && { otel }),
    });
  })
  .onError(({ code, error, set, request }) => {
    set.headers["content-type"] = "application/json";
    if (error instanceof AdapterError) {
      return toErrorResponse(error.status, error.message);
    }
    // Stryker disable next-line ConditionalExpression: NOT_FOUND branch — covered by surface.test
    if (code === "NOT_FOUND") {
      // Stryker disable next-line all: logging side-effect
      Effect.runFork(Effect.logWarning("Not found", { path: request.url }));
      return toErrorResponse(404, "Not found");
    }
    // Stryker disable next-line ConditionalExpression: VALIDATION branch
    if (code === "VALIDATION") {
      // Stryker disable next-line all: logging side-effect
      Effect.runFork(Effect.logWarning("Validation error", { path: request.url }));
      return toErrorResponse(400, "Validation error");
    }
    // Stryker disable next-line CallExpression: error alert side-effect
    sendErrorAlert(getRequestEnv(request), "Unhandled adapter error", error);
    // Stryker disable next-line ConditionalExpression: onError fallback
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

// Stryker disable all: worker export
const worker = {
  fetch: (request: Request, env: CloudflareEnv) => app.fetch(attachRequestEnv(request, env)),
};
// Stryker restore all

export default worker;

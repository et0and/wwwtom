import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { cors } from "@elysiajs/cors";
import { Effect, Option, Schema } from "effect";
import { otelConfigFromEnv, logLevelFromEnv } from "@tom/utils/logging";
import {
  attachRequestContext,
  attachRequestEnv,
  errorDetailsFromRequest,
  getRequestEnv,
  problemTypeForStatus,
  sendErrorAlert,
  toProblemResponse,
  toValidationProblems,
} from "@tom/utils/worker";
import type { CloudflareEnv } from "@tom/utils/config";
import { HttpStatus } from "@tom/constants/http";
import { ProblemType } from "@tom/constants/problem";
import { AdapterError } from "./runtime";
import { allowLocalOriginsForAdapter, isTrustedWebOrigin, tenantFromValue } from "./origins";
import { arenaIntegration } from "./arena";
import { authIntegration } from "./auth";
import { cmsIntegration } from "./cms";
import { frameIntegration } from "./frame";
import { gavinIntegration } from "./gavin";
import { guestbookIntegration } from "./guestbook";
import { githubIntegration } from "./github";
import { imageIntegration } from "./image";
import { ogIntegration } from "./og";
import { weatherIntegration } from "./weather";

const VISITOR_SESSION_MAX_AGE = 60 * 60 * 24 * 90;

/**
 * Route gate for tenant-specific surfaces. Unset `TENANT` keeps the legacy
 * shared app (local dev, tests); a named tenant sees only its own routes.
 */
const requireTenantBeforeHandle =
  (tenant: "tom" | "sophie") =>
  ({ request }: { request: Request }): void => {
    const current = tenantFromValue(getRequestEnv(request).TENANT);
    if (current !== undefined && current !== tenant) {
      throw new AdapterError({ status: HttpStatus.NotFound, message: "Not found" });
    }
  };

export const app = new Elysia({
  adapter: CloudflareAdapter,
  name: "tom-adapter",
})
  .use(
    cors({
      origin: (request) => {
        const origin = request.headers.get("origin");
        if (!origin) return false;
        // Local editors are trusted only when this worker itself runs on
        // localhost — never on the request hostname, which a client
        // controls, and never via NODE_ENV, which harnesses run as
        // production. Each tenant trusts only its own hosts (TENANT).
        const env = getRequestEnv(request);
        return isTrustedWebOrigin(
          origin,
          allowLocalOriginsForAdapter(env.ADAPTER_URL),
          tenantFromValue(env.TENANT),
        );
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "x-use-simulator"],
    }),
  )
  .derive(async ({ set, request, cookie }) => {
    const requestId = crypto.randomUUID();
    set.headers["x-request-id"] = requestId;
    const env = getRequestEnv(request);

    const visitorId = Option.match(
      Schema.decodeUnknownOption(Schema.String)(cookie.tom_session?.value),
      {
        onNone: () => {
          const generated = crypto.randomUUID();
          cookie.tom_session?.set({
            value: generated,
            maxAge: VISITOR_SESSION_MAX_AGE,
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
          });
          return generated;
        },
        onSome: (value) => value,
      },
    );

    const guestbookSession = cookie.guestbook_session?.value;
    const otel = await otelConfigFromEnv(env);
    attachRequestContext(request, {
      requestId,
      sessionId: Option.getOrElse(
        Schema.decodeUnknownOption(Schema.String)(guestbookSession),
        () => visitorId,
      ),
      logLevel: logLevelFromEnv(env),
      ...(otel && { otel }),
    });
  })
  .onError(({ code, error, request }) => {
    if (Schema.is(AdapterError)(error)) {
      if (error.status >= HttpStatus.InternalServerError) {
        sendErrorAlert(
          getRequestEnv(request),
          `Adapter ${error.status} error`,
          error,
          errorDetailsFromRequest(request, { service: "tom-adapter", status: error.status }),
        );
      }
      const type = problemTypeForStatus(error.status);
      return toProblemResponse(error.status, error.message, {
        ...(type && { type }),
        instance: request.url,
      });
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
    sendErrorAlert(
      getRequestEnv(request),
      "Unhandled adapter error",
      error,
      errorDetailsFromRequest(request, {
        service: "tom-adapter",
        status: HttpStatus.InternalServerError,
      }),
    );
    return toProblemResponse(HttpStatus.InternalServerError, "Internal server error");
  })
  .use(authIntegration)
  .use(frameIntegration)
  .use(gavinIntegration)
  .use(githubIntegration)
  .use(imageIntegration)
  .use(ogIntegration)
  .use(weatherIntegration)
  // are.na content and the guestbook are Tom-only: Sophie's blog reads its
  // CMS and its adapter binds no database to hold guestbook entries.
  .guard({ beforeHandle: requireTenantBeforeHandle("tom") }, (app) =>
    app.use(arenaIntegration).use(guestbookIntegration),
  )
  // The CMS is Sophie-only. Tom's editor is retired and its site reads
  // are.na, so no CMS read or write route exists on the Tom adapter.
  .guard({ beforeHandle: requireTenantBeforeHandle("sophie") }, (app) => app.use(cmsIntegration))
  .compile();

export type AdapterApp = typeof app;

const worker = {
  fetch: (request: Request, env: CloudflareEnv) => app.fetch(attachRequestEnv(request, env)),
};

export default worker;

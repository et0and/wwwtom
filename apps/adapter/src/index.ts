import {
  Elysia,
  ValidationError,
  type InternalServerError,
  type NotFoundError,
  type ParseError,
} from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { cors } from "@elysiajs/cors";
import { Effect, Option, Schema } from "effect";
import { otelConfigFromEnv, logLevelFromEnv } from "@tom/utils/services/logging";
import {
  attachRequestContext,
  attachRequestEnv,
  getRequestEnv,
  sendErrorAlert,
  toProblemResponse,
} from "@tom/utils/services/worker";
import type { CloudflareEnv } from "@tom/utils/services/config";
import { HttpStatus } from "@tom/constants/http";
import { ProblemType } from "@tom/constants/problem";
import { AdapterError } from "./config/effect";
import { arenaIntegration } from "./integrations/arena";
import { payloadIntegration } from "./integrations/payload";
import { polarIntegration } from "./integrations/polar";
import { guestbookIntegration, userCookieSchema } from "./integrations/guestbook";
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

    const sessionValue = Schema.decodeUnknownOption(Schema.String)(cookie.tom_session?.value);
    const visitorId = Option.getOrElse(sessionValue, () => crypto.randomUUID());
    if (Option.isNone(sessionValue)) {
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
    const userJson = Option.getOrElse(
      Schema.decodeUnknownOption(Schema.String)(cookie.guestbook_user?.value),
      () => JSON.stringify(cookie.guestbook_user?.value),
    );
    const userId = Option.getOrElse(
      Option.map(
        Schema.decodeUnknownOption(userCookieSchema)(userJson),
        (user) => `${user.username}@${user.instance}`,
      ),
      () => undefined,
    );
    const otel = await otelConfigFromEnv(env);
    attachRequestContext(request, {
      requestId,
      sessionId: Option.getOrElse(
        Schema.decodeUnknownOption(Schema.String)(guestbookSession),
        () => visitorId,
      ),
      ...(userId && { userId }),
      logLevel: logLevelFromEnv(env),
      ...(otel && { otel }),
    });
  })
  .onError(({ code, error, request }) => {
    if (Schema.is(AdapterError)(error)) {
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
    sendErrorAlert(getRequestEnv(request), "Unhandled adapter error", error);
    return toProblemResponse(HttpStatus.InternalServerError, "Internal server error");
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

/**
 * Field-level problems from an Elysia validation failure, as the RFC 9457
 * `errors` extension (JSON-pointer paths, rfc9457 §3.2).
 */
const toValidationProblems = (
  error: Error | ValidationError | ParseError | NotFoundError | InternalServerError,
): readonly { readonly detail: string; readonly pointer: string }[] | undefined =>
  error instanceof ValidationError && error.all.length > 0
    ? error.all.map(({ path, message }) => ({ detail: message, pointer: toPointer(path) }))
    : undefined;

/** Dot-joined Elysia error paths become RFC 6901 JSON pointers. */
const toPointer = (path: string): string =>
  path === "root" ? "#" : `#/${path.split(".").join("/")}`;

/** RFC 9457 problem type for a wrapped AdapterError's status, when known. */
const problemTypeForStatus = (status: number): string | undefined => {
  switch (status) {
    case HttpStatus.BadRequest:
      return ProblemType.Validation;
    case HttpStatus.Unauthorized:
      return ProblemType.Unauthorized;
    case HttpStatus.Forbidden:
      return ProblemType.Forbidden;
    case HttpStatus.NotFound:
      return ProblemType.NotFound;
    default:
      return undefined;
  }
};

const worker = {
  fetch: (request: Request, env: CloudflareEnv) => app.fetch(attachRequestEnv(request, env)),
};

export default worker;

import { Effect, Layer, Schema } from "effect";
import { errorResponseSchema } from "@tom/schemas/error";
import { HttpStatus, isErrorStatus } from "@tom/constants/http";
import { WorkerEnvMissingError } from "@tom/types/errors";
import { TelegramService } from "../telegram";
import { withLogging } from "./logging";
import type { LogContext, OtelConfig } from "./logging";
import { makeAppConfigLayer } from "./config";
import type { CloudflareEnv } from "./config";

export const runEffect = <A, E>(effect: Effect.Effect<A, E>, context: LogContext): Promise<A> =>
  Effect.runPromise(withLogging(effect, context));

/**
 * Build the logging context for a request from the requestId/sessionId/userId
 * and OTEL config attached by the worker's onRequest middleware.
 */
export const logContextFromRequest = (request: Request, serviceName: string): LogContext => ({
  serviceName,
  ...getRequestContext(request),
});

const createTelegramLayer = (env: CloudflareEnv) => {
  const configLayer = makeAppConfigLayer({
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: env.TELEGRAM_CHAT_ID,
  });
  return Layer.provide(TelegramService.Default, configLayer);
};

export const sendErrorAlert = (env: CloudflareEnv, message: string, cause?: unknown) => {
  const layer = createTelegramLayer(env);
  Effect.runFork(
    Effect.gen(function* () {
      const telegram = yield* TelegramService;
      yield* telegram.sendError(message, cause);
    }).pipe(
      Effect.provide(layer),
      Effect.catch(() => Effect.void),
    ),
  );
};

/**
 * Cloudflare passes (request, env, ctx) to the worker's fetch handler.
 * Elysia only forwards the Request, so the env is attached to the request
 * by the default export wrapper and read back here.
 */
export type RequestWithEnv = Request & { env: CloudflareEnv };

export const attachRequestEnv = (request: Request, env: CloudflareEnv): RequestWithEnv => {
  (request as RequestWithEnv).env = env;
  return request as RequestWithEnv;
};

export const getRequestEnv = (request: Request): CloudflareEnv => {
  const env = (request as RequestWithEnv).env;
  if (!env) {
    throw new WorkerEnvMissingError({ message: "Worker env not attached to request" });
  }
  return env;
};

/**
 * Per-request logging context (requestId, sessionId, userId, log level, OTEL
 * config) attached by the worker entry's onRequest middleware and read back
 * by route handlers so every log line is correlated. Mirrors the
 * RequestWithEnv pattern.
 */
export type RequestContext = {
  readonly requestId?: string;
  readonly sessionId?: string;
  readonly userId?: string;
  readonly logLevel?: "Debug" | "Info";
  readonly otel?: OtelConfig;
};

type RequestWithContext = Request & { requestContext?: RequestContext };

export const attachRequestContext = (request: Request, context: RequestContext): Request => {
  (request as RequestWithContext).requestContext = context;
  return request;
};

export const getRequestContext = (request: Request): RequestContext =>
  (request as RequestWithContext).requestContext ?? {};

/**
 * Log an API failure at the level that matches its status: expected client
 * errors (4xx) are warnings, unexpected failures are errors.
 */
export const logApiFailure = (message: string, status: number, cause?: unknown) =>
  status >= HttpStatus.BadRequest && status < HttpStatus.InternalServerError
    ? Effect.logWarning(message, cause === undefined ? { status } : { status, cause })
    : Effect.logError(message, cause === undefined ? { status } : { status, cause });

/**
 * An error response status must be a real 4xx/5xx code; anything else (a
 * 0 sentinel, a redirect class, a non-integer) would produce an invalid
 * HTTP response, so fall back to 500 at the boundary.
 */
const toErrorStatus = (status: number): number =>
  isErrorStatus(status) ? status : HttpStatus.InternalServerError;

export const toErrorResponse = (status: number, error: string, cause?: string): Response =>
  new Response(
    JSON.stringify(Schema.encodeSync(errorResponseSchema)(cause ? { error, cause } : { error })),
    {
      status: toErrorStatus(status),
      headers: { "Content-Type": "application/json" },
    },
  );

/** Human-readable message from an unknown failure (Error or string). */
export const toErrorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

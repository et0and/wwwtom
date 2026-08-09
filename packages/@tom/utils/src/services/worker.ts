import { Effect, Layer, Schema } from "effect";
import { errorResponseSchema } from "@tom/schemas/error";
import { HttpStatus } from "@tom/constants/http";
import { WorkerEnvMissingError } from "@tom/types/errors";
import { TelegramService } from "../telegram";
import { withLogging } from "./logging";
import type { LogContext, OtelConfig } from "./logging";
import { makeAppConfigLayer } from "./config";
import type { CloudflareEnv } from "./config";

export type { LogContext, OtelConfig } from "./logging";

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

export const sendErrorAlert = (env: CloudflareEnv, message: string, error?: unknown) => {
  const layer = createTelegramLayer(env);
  Effect.runFork(
    Effect.gen(function* () {
      const telegram = yield* TelegramService;
      yield* telegram.sendError(message, error);
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
export type WorkerExecutionContext = {
  readonly waitUntil: (promise: Promise<unknown>) => void;
};

export type RequestWithEnv = Request & {
  env: CloudflareEnv;
  ctx?: WorkerExecutionContext | undefined;
};

export const attachRequestEnv = (
  request: Request,
  env: CloudflareEnv,
  ctx?: WorkerExecutionContext,
): RequestWithEnv => {
  (request as RequestWithEnv).env = env;
  (request as RequestWithEnv).ctx = ctx;
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

export const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Log an API failure at the level that matches its status: expected client
 * errors (4xx) are warnings, unexpected failures are errors.
 */
export const logApiFailure = (message: string, status: number, data?: unknown) =>
  status >= HttpStatus.BadRequest && status < HttpStatus.InternalServerError
    ? Effect.logWarning(message, data === undefined ? { status } : { status, data })
    : Effect.logError(message, data === undefined ? { status } : { status, data });

export const toErrorResponse = (status: number, error: string, cause?: string): Response =>
  new Response(
    JSON.stringify(Schema.encodeSync(errorResponseSchema)(cause ? { error, cause } : { error })),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );

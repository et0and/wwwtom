import { Effect, Layer, Schema } from "effect";
import { problemDetailsSchema, type ProblemDetails } from "@tom/schemas/error";
import { HttpStatus, isErrorStatus } from "@tom/constants/http";
import { PROBLEM_JSON_MEDIA_TYPE, ProblemType } from "@tom/constants/problem";
import { WorkerEnvMissingError } from "@tom/types/errors";
import { TelegramService } from "../telegram";
import type { AlertLink, ErrorAlertDetails } from "@tom/schemas/telegram";
import { withLogging } from "./logging";
import type { LogContext, OtelConfig } from "./logging";
import { makeAppConfigLayer, readCloudflareEnv } from "./config";
import type { CloudflareEnv } from "./config";

export const runEffect = <A, E>(effect: Effect.Effect<A, E>, context: LogContext): Promise<A> =>
  Effect.runPromise(withLogging(effect, context));

/**
 * Build the logging context for a request from the requestId/sessionId/userId,
 * method/path/url, and OTEL config attached by the worker's onRequest middleware.
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

export const sendErrorAlert = (
  env: CloudflareEnv,
  message: string,
  cause?: unknown,
  details?: ErrorAlertDetails,
) => {
  void readCloudflareEnv(env)
    .then((resolved) => {
      const layer = createTelegramLayer(resolved);
      const stage = details?.stage ?? resolved.TOM_STAGE;
      Effect.runFork(
        Effect.gen(function* () {
          const telegram = yield* TelegramService;
          yield* telegram.sendError(message, cause, {
            ...details,
            ...(stage && { stage }),
            links: [...(details?.links ?? []), ...dashboardLinks()],
          });
        }).pipe(
          Effect.provide(layer),
          Effect.catch(() => Effect.void),
        ),
      );
    })
    .catch(() => undefined);
};

/** Axiom organization slug for dashboard links in Telegram error alerts. */
const AXIOM_ORG = "yufugumi-tchp";

/**
 * Dashboard buttons for error alerts. The Cloudflare link needs no account
 * ID (`:account` resolves in the dashboard).
 */
export const dashboardLinks = (): readonly AlertLink[] => [
  { text: "Axiom logs", url: `https://app.axiom.co/${AXIOM_ORG}/query` },
  {
    text: "Cloudflare Workers",
    url: "https://dash.cloudflare.com/?to=/:account/workers-and-pages",
  },
];

/**
 * Build alert details from the request logging context plus the route and
 * status, so Telegram errors carry the requestId that correlates Axiom
 * logs/traces and Workers Logs.
 */
export const errorDetailsFromRequest = (
  request: Request,
  options?: { service?: string; status?: number },
): ErrorAlertDetails => {
  const context = getRequestContext(request);
  return {
    ...(options?.service && { service: options.service }),
    ...(options?.status !== undefined && { status: options.status }),
    method: request.method,
    path: new URL(request.url).pathname,
    ...(context.requestId && { requestId: context.requestId }),
    ...(context.sessionId && { sessionId: context.sessionId }),
    ...(context.userId && { userId: context.userId }),
  };
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
 * Per-request logging context (requestId, sessionId, userId, method/path/url,
 * log level, OTEL config) attached by the worker entry's onRequest middleware
 * and read back by route handlers so every log line is correlated. Mirrors the
 * RequestWithEnv pattern.
 */
export type RequestContext = {
  readonly requestId?: string;
  readonly sessionId?: string;
  readonly userId?: string;
  readonly method?: string;
  readonly path?: string;
  readonly url?: string;
  readonly logLevel?: "Debug" | "Info";
  readonly otel?: OtelConfig;
};

type RequestWithContext = Request & { requestContext?: RequestContext };

export const attachRequestContext = (request: Request, context: RequestContext): Request => {
  (request as RequestWithContext).requestContext = {
    method: request.method,
    path: new URL(request.url).pathname,
    url: request.url,
    ...context,
  };
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

/**
 * RFC 9457 problem-details response (rfc9457 §3). `type` defaults to
 * `about:blank`, the RFC's generic fallback; pass a ProblemType constant for
 * known problems. Field-level validation problems ride in the `errors`
 * extension with JSON-pointer paths.
 */
export const toProblemResponse = (
  status: number,
  title: string,
  options: ProblemDetailsOptions = {},
): Response =>
  new Response(
    JSON.stringify(
      Schema.encodeSync(problemDetailsSchema)({
        type: options.type ?? ProblemType.AboutBlank,
        status: toErrorStatus(status),
        title,
        ...(options.detail !== undefined && { detail: options.detail }),
        ...(options.instance !== undefined && { instance: options.instance }),
        ...(options.errors !== undefined && { errors: options.errors }),
      }),
    ),
    {
      status: toErrorStatus(status),
      headers: { "Content-Type": PROBLEM_JSON_MEDIA_TYPE },
    },
  );

type ProblemDetailsOptions = {
  readonly [K in "type" | "detail" | "instance" | "errors"]?: ProblemDetails[K];
};

/** Human-readable message from an unknown failure (Error or string). */
export const toErrorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

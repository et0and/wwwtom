import { Effect, Layer, Logger, References, Schema } from "effect";
import { errorResponseSchema } from "@tom/schemas";
import { WorkerEnvMissingError } from "@tom/types/errors";
import { TelegramService } from "../telegram";
import { makeAppConfigLayer } from "./config";
import type { CloudflareEnv } from "./config";

export const withLogging = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provideService(References.MinimumLogLevel, "Info"),
    Effect.provide(Logger.layer([Logger.consoleStructured])),
  );

export const runEffect = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(withLogging(effect));

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

export const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const toErrorResponse = (status: number, error: string, cause?: string): Response =>
  new Response(
    JSON.stringify(Schema.encodeSync(errorResponseSchema)(cause ? { error, cause } : { error })),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );

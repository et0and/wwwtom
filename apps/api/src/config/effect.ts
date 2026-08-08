import { Effect, Layer, Logger, References } from "effect";
import { TelegramService, makeAppConfigLayer, readCloudflareEnv } from "@tom/utils/services";
import type { CloudflareEnv } from "@tom/utils/services";

export type Env = CloudflareEnv & {
  POLAR_API_URL?: string;
};

export const resolveEnv = (env: Env) => readCloudflareEnv(env);

export const runEffect = <A, E>(effect: Effect.Effect<A, E>) => {
  return Effect.runPromise(
    effect.pipe(
      Effect.provideService(References.MinimumLogLevel, "Info"),
      Effect.provide(Logger.layer([Logger.consoleStructured])),
    ),
  );
};

export const createApiLayer = (env: Env) => {
  const configLayer = makeAppConfigLayer({
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: env.TELEGRAM_CHAT_ID,
  });
  return Layer.provide(TelegramService.Default, configLayer);
};

export const sendErrorAlert = (env: Env, message: string, error?: unknown) => {
  const layer = createApiLayer(env);
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
export type RequestWithEnv = Request & { env?: Env };

export const getRequestEnv = (request: Request): Env => {
  const env = (request as RequestWithEnv).env;
  if (!env) {
    throw new Error("Worker env not attached to request");
  }
  return env;
};

export const toJsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

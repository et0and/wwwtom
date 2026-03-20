import { Effect, Layer, Logger, LogLevel } from "effect";
import { TelegramService, makeAppConfigLayer } from "@tom/utils/services";
import type { CloudflareEnv } from "@tom/utils/services";

export type Env = CloudflareEnv;

export const runEffect = <A, E>(effect: Effect.Effect<A, E>) => {
  return Effect.runPromise(
    effect.pipe(Logger.withMinimumLogLevel(LogLevel.Info), Effect.provide(Logger.structured)),
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
      Effect.catchAll(() => Effect.void),
    ),
  );
};

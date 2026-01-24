import { Effect, Layer, Logger, LogLevel } from "effect";
import { getRequestEvent } from "solid-js/web";
import type { CloudflareEnv } from "@tom/utils/services";
import { AppConfig, makeAppConfigLayer } from "@tom/utils/services";
import { DatabaseService, DatabaseServiceLive } from "@tom/db/service";
import { PayloadService, PayloadServiceLive } from "@tom/payload/service";
import { ArenaService, ArenaServiceLive } from "@tom/arena/service";

export type AllServices = AppConfig | DatabaseService | PayloadService | ArenaService;

const AllServicesLive = Layer.mergeAll(DatabaseServiceLive, PayloadServiceLive, ArenaServiceLive);

export type CompositeLayer = Layer.Layer<AllServices>;

export const createServicesLayer = (env: CloudflareEnv): CompositeLayer => {
  const configLayer = makeAppConfigLayer(env);
  const servicesWithConfig = Layer.provide(AllServicesLive, configLayer);
  return Layer.merge(configLayer, servicesWithConfig) as CompositeLayer;
};

declare module "vinxi/http" {
  interface H3EventContext {
    effectLayer?: CompositeLayer;
  }
}

export const getServiceLayer = (): CompositeLayer | undefined => {
  const event = getRequestEvent();
  return event?.nativeEvent.context.effectLayer;
};

const getMinLogLevel = () => {
  const isDev = import.meta.env.DEV;
  return isDev ? LogLevel.Debug : LogLevel.Info;
};

const withLogging = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Logger.withMinimumLogLevel(getMinLogLevel()), Effect.provide(Logger.structured));

/**
 * Run a simple effect without services.
 * For effects that don't require any services, just logging.
 */
export const runSimpleEffect = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => {
  return Effect.runPromise(withLogging(effect));
};

/**
 * Run an effect that requires services.
 * Gets the layer from the current request context.
 *
 * @example
 * ```ts
 * const result = await runEffect(
 *   Effect.gen(function* () {
 *     const db = yield* DatabaseService;
 *     return yield* db.getGuestbookEntries({ page: 1 });
 *   })
 * );
 * ```
 */
export const runEffect = <A, E>(effect: Effect.Effect<A, E, AllServices>): Promise<A> => {
  const layer = getServiceLayer();

  if (!layer) {
    return Promise.reject(
      new Error("Service layer not initialised. Ensure entry-server.tsx sets up the layer."),
    );
  }

  return Effect.runPromise(effect.pipe(Effect.provide(layer), withLogging));
};

/**
 * Run an effect with action logging wrapper.
 * Logs the start, success, and failure of the action.
 */
export const runWithLogs = <A, E>(
  name: string,
  effect: Effect.Effect<A, E, AllServices>,
): Promise<A> => {
  const wrapped = Effect.gen(function* () {
    yield* Effect.logInfo(`${name}:start`);
    const result = yield* effect;
    yield* Effect.logInfo(`${name}:success`);
    return result;
  }).pipe(
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(`${name}:error`, error);
        return yield* Effect.fail(error);
      }),
    ),
  );

  return runEffect(wrapped as Effect.Effect<A, E, AllServices>);
};

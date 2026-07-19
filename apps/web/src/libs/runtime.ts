import { Effect, Layer, Logger, References } from "effect";
import { getRequestEvent } from "solid-js/web";
import type { CloudflareEnv } from "@tom/utils/services";
import { AppConfig, makeAppConfigLayer } from "@tom/utils/services";
import { DatabaseService } from "@tom/db/service";
import { PayloadService } from "@tom/payload/service";
import { ArenaService } from "@tom/arena/service";

export type AllServices = AppConfig | PayloadService | ArenaService;
export type AllServicesWithDb = AllServices | DatabaseService;

const CoreServicesLive = Layer.mergeAll(PayloadService.Default, ArenaService.Default);

export type CompositeLayer = Layer.Layer<AllServices>;
export type CompositeLayerWithDb = Layer.Layer<AllServicesWithDb>;

export const createServicesLayer = (env: CloudflareEnv): CompositeLayer => {
  const configLayer = makeAppConfigLayer(env);
  const servicesWithConfig = Layer.provide(CoreServicesLive, configLayer);
  return Layer.merge(configLayer, servicesWithConfig) as CompositeLayer;
};

export const createServicesLayerWithDb = (env: CloudflareEnv): CompositeLayerWithDb => {
  const configLayer = makeAppConfigLayer(env);
  const allServices = Layer.mergeAll(CoreServicesLive, DatabaseService.Default);
  const servicesWithConfig = Layer.provide(allServices, configLayer);
  return Layer.merge(configLayer, servicesWithConfig) as CompositeLayerWithDb;
};

const getDevEnv = (): CloudflareEnv => ({
  ARENA_TOKEN: process.env.ARENA_TOKEN ?? import.meta.env.ARENA_TOKEN,
  PAYLOAD_URL: process.env.PAYLOAD_URL ?? import.meta.env.PAYLOAD_URL,
  DATABASE_URL: process.env.DATABASE_URL ?? import.meta.env.DATABASE_URL,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? import.meta.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ?? import.meta.env.TELEGRAM_CHAT_ID,
  NODE_ENV: process.env.NODE_ENV ?? "development",
});

type RequestContext = {
  effectLayer?: CompositeLayer;
  effectLayerWithDb?: CompositeLayerWithDb;
  cloudflare?: { env?: CloudflareEnv };
};

export const getServiceLayer = (): CompositeLayer | undefined => {
  const event = getRequestEvent();
  if (!event) return undefined;

  const context = event.nativeEvent.context as RequestContext;
  if (context.effectLayer) return context.effectLayer;

  const cfEnv = context.cloudflare?.env as CloudflareEnv | undefined;
  const env = cfEnv ?? getDevEnv();
  const layer = createServicesLayer(env);
  context.effectLayer = layer;
  return layer;
};

export const getServiceLayerWithDb = (): CompositeLayerWithDb | undefined => {
  const event = getRequestEvent();
  if (!event) return undefined;

  const context = event.nativeEvent.context as RequestContext;
  if (context.effectLayerWithDb) return context.effectLayerWithDb;

  const cfEnv = context.cloudflare?.env as CloudflareEnv | undefined;
  const env = cfEnv ?? getDevEnv();
  const layer = createServicesLayerWithDb(env);
  context.effectLayerWithDb = layer;
  return layer;
};

const getMinLogLevel = (): "Debug" | "Info" => {
  const isDev = import.meta.env.DEV;
  return isDev ? "Debug" : "Info";
};

const withLogging = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provideService(References.MinimumLogLevel, getMinLogLevel()),
    Effect.provide(Logger.layer([Logger.formatJson])),
  );

/**
 * Run a simple effect without services.
 * For effects that don't require any services, just logging.
 */
export const runSimpleEffect = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => {
  return Effect.runPromise(withLogging(effect));
};

/**
 * Run an effect that requires services.
 * The layer must be captured at the start of the server function before any async operations.
 */
export const runEffect = <A, E>(
  effect: Effect.Effect<A, E, AllServices>,
  layer?: CompositeLayer,
): Promise<A> => {
  const resolvedLayer = layer ?? getServiceLayer();

  if (!resolvedLayer) {
    return Promise.reject(
      new Error("Service layer not initialised. Ensure middleware sets up the layer."),
    );
  }

  return Effect.runPromise(effect.pipe(Effect.provide(resolvedLayer), withLogging));
};

/**
 * Run an effect that requires services including DatabaseService.
 * Use this for routes that need database access (e.g., guestbook).
 */
export const runEffectWithDb = <A, E>(
  effect: Effect.Effect<A, E, AllServicesWithDb>,
  layer?: CompositeLayerWithDb,
): Promise<A> => {
  const resolvedLayer = layer ?? getServiceLayerWithDb();

  if (!resolvedLayer) {
    return Promise.reject(
      new Error("Service layer not initialised. Ensure middleware sets up the layer."),
    );
  }

  return Effect.runPromise(effect.pipe(Effect.provide(resolvedLayer), withLogging));
};

/**
 * Run an effect with action logging wrapper.
 * Logs the start, success, and failure of the action.
 */
export const runWithLogs = <A, E>(
  name: string,
  effect: Effect.Effect<A, E, AllServices>,
  layer?: CompositeLayer,
): Promise<A> => {
  const wrapped = Effect.gen(function* () {
    yield* Effect.logInfo(`${name}:start`);
    const result = yield* effect;
    yield* Effect.logInfo(`${name}:success`);
    return result;
  }).pipe(
    Effect.catch(
      Effect.fn("runWithLogsErrorHandler")(function* (error: E) {
        yield* Effect.logError(`${name}:error`, error);
        return yield* Effect.fail(error);
      }),
    ),
  );

  return runEffect(wrapped as Effect.Effect<A, E, AllServices>, layer);
};

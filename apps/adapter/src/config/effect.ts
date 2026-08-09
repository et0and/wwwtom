import { Effect, Layer } from "effect";
import { AppConfig, makeAppConfigLayer, withLogging } from "@tom/utils/services";
import type { CloudflareEnv } from "@tom/utils/services";
import { DatabaseService } from "@tom/db/service";
import { PayloadService } from "@tom/payload/service";
import { ArenaService } from "@tom/arena/service";

/**
 * Build a layer for a single service, providing only the config it needs.
 * Services are constructed lazily so an unconfigured integration never
 * breaks the others.
 */
const createServiceLayer = <S, E, R>(
  env: CloudflareEnv,
  service: Layer.Layer<S, E, R>,
): Layer.Layer<AppConfig | S, E, never> => {
  const configLayer = makeAppConfigLayer(env);
  // `Layer.provide` cannot reduce `Exclude<R, AppConfig>` while `R` is generic,
  // but at every call site `R` is exactly `AppConfig`.
  return Layer.merge(configLayer, Layer.provide(service, configLayer)) as Layer.Layer<
    AppConfig | S,
    E,
    never
  >;
};

export const createArenaLayer = (env: CloudflareEnv) =>
  createServiceLayer(env, ArenaService.Default);

export const createPayloadLayer = (env: CloudflareEnv) =>
  createServiceLayer(env, PayloadService.Default);

export const createDbLayer = (env: CloudflareEnv) =>
  createServiceLayer(env, DatabaseService.Default);

/**
 * Error thrown by integration runners when the underlying Effect fails.
 * The global onError hook maps it to a JSON response with the right status.
 */
export class AdapterError extends Error {
  readonly _tag = "AdapterError";
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AdapterError";
  }
}

/**
 * Run an effect (already provided with its layer) and reject with an AdapterError
 * on failure, so Elysia's onError can map it to a JSON response.
 * Error mapping happens in the Effect error channel, so errors stay values.
 */
export const runAdapter = <A, E>(
  effect: Effect.Effect<A, E>,
  toAdapterError: (error: E) => AdapterError,
): Promise<A> => Effect.runPromise(withLogging(effect.pipe(Effect.mapError(toAdapterError))));

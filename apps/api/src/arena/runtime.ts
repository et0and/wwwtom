import { Layer } from "effect";
import { type AppConfig, type CloudflareEnv, makeAppConfigLayer } from "@tom/utils/config";
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

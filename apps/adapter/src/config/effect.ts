import { Effect, Layer, Logger, References } from "effect";
import {
  AppConfig,
  TelegramService,
  makeAppConfigLayer,
  readCloudflareEnv,
} from "@tom/utils/services";
import type { CloudflareEnv } from "@tom/utils/services";
import { DatabaseService } from "@tom/db/service";
import { PayloadService } from "@tom/payload/service";
import { ArenaService } from "@tom/arena/service";

export type AdapterEnv = CloudflareEnv & {
  ADAPTER_URL?: string;
  API_URL?: string;
  GUESTBOOK_RETURN_URL?: string;
  POLAR_API_URL?: string;
  ARENA_API_URL?: string;
};

export type AllServices = AppConfig | PayloadService | ArenaService;
export type AllServicesWithDb = AllServices | DatabaseService;

export const resolveEnv = (env: AdapterEnv) => readCloudflareEnv(env);

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

export const createApiLayer = (env: CloudflareEnv) => {
  const configLayer = makeAppConfigLayer({
    TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: env.TELEGRAM_CHAT_ID,
  });
  return Layer.provide(TelegramService.Default, configLayer);
};

export const sendErrorAlert = (env: CloudflareEnv, message: string, error?: unknown) => {
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

const withLogging = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provideService(References.MinimumLogLevel, "Info"),
    Effect.provide(Logger.layer([Logger.consoleStructured])),
  );

export const runEffect = <A, E>(effect: Effect.Effect<A, E>) =>
  Effect.runPromise(withLogging(effect));

/**
 * Cloudflare passes (request, env, ctx) to the worker's fetch handler.
 * Elysia only forwards the Request, so the env is attached to the request
 * by the default export wrapper and read back here.
 */
export type RequestWithEnv = Request & { env?: AdapterEnv };

export const getRequestEnv = (request: Request): AdapterEnv => {
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

export const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Run an effect (already provided with its layer) and reject with an AdapterError
 * on failure, so Elysia's onError can map it to a JSON response.
 * Error mapping happens in the Effect error channel, so errors stay values.
 */
export const runAdapter = <A, E>(
  effect: Effect.Effect<A, E>,
  toAdapterError: (error: E) => AdapterError,
): Promise<A> => Effect.runPromise(withLogging(effect.pipe(Effect.mapError(toAdapterError))));

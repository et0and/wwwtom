import { Effect, Logger, LogLevel, Redacted } from "effect";

declare const DEV: boolean | undefined;

const getMinLogLevel = () => {
  const isDev = Redacted.make(typeof DEV !== "undefined" ? DEV.toString() : "false");
  return Redacted.value(isDev) === "true" ? LogLevel.Debug : LogLevel.Info;
};

export const runServerEffect = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => {
  return Effect.runPromise(effect.pipe(Logger.withMinimumLogLevel(getMinLogLevel())));
};

export const logger = {
  info: (message: string, ...args: unknown[]) => {
    Effect.runPromise(Effect.logInfo(message, ...args));
  },
  debug: (message: string, ...args: unknown[]) => {
    Effect.runPromise(Effect.logDebug(message, ...args));
  },
  warn: (message: string, ...args: unknown[]) => {
    Effect.runPromise(Effect.logWarning(message, ...args));
  },
  error: (message: string, ...args: unknown[]) => {
    Effect.runPromise(Effect.logError(message, ...args));
  },
  log: (message: string, ...args: unknown[]) => {
    Effect.runPromise(Effect.log(message, ...args));
  },
};

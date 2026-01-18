import { Effect, Logger, LogLevel, Redacted } from "effect";

declare const DEV: boolean | undefined;

let waitUntil: ((promise: Promise<unknown>) => void) | null = null;
let errorCallback: ((message: string, error?: unknown) => Promise<void>) | null = null;

export const setWaitUntil = (fn: (promise: Promise<unknown>) => void) => {
  waitUntil = fn;
};

export const setErrorCallback = (cb: (message: string, error?: unknown) => Promise<void>) => {
  errorCallback = cb;
};

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
    if (errorCallback) {
      const promise = errorCallback(message, args[0]);
      if (waitUntil) {
        waitUntil(promise);
      }
    }
  },
  log: (message: string, ...args: unknown[]) => {
    Effect.runPromise(Effect.log(message, ...args));
  },
};

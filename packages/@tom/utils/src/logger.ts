import { Effect, Logger, LogLevel, Redacted } from "effect";

declare const DEV: boolean | undefined;

type WaitUntil = (promise: Promise<unknown>) => void;
type ErrorCallback = (message: string, error?: unknown) => Promise<void>;
type LogContext = {
  sessionId?: string;
  requestId?: string;
  module?: string;
};
type PartialIds = Partial<Pick<LogContext, "sessionId" | "requestId">>;

const waitRef: { current: WaitUntil | null } = { current: null };
const errorRef: { current: ErrorCallback | null } = { current: null };

export const setWaitUntil = (fn: WaitUntil) => {
  waitRef.current = fn;
};

export const setErrorCallback = (cb: ErrorCallback) => {
  errorRef.current = cb;
};

const randomId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  }

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const createLogIds = () => {
  return {
    requestId: randomId(),
    sessionId: randomId(),
  };
};

export const createLogContext = (module?: string) => {
  const ids = createLogIds();

  if (!module) {
    return ids;
  }

  return {
    ...ids,
    module,
  };
};

const buildContext = (module: string, ids?: PartialIds): LogContext => {
  return {
    module,
    sessionId: ids?.sessionId ?? randomId(),
    requestId: ids?.requestId ?? randomId(),
  };
};

export const makeScopedRunner = (module: string) => {
  return <A, E>(effect: Effect.Effect<A, E>, ids?: PartialIds) => {
    const ctx = buildContext(module, ids);
    return runServerEffect(withLogContext(ctx, effect));
  };
};

const getMinLogLevel = () => {
  const isDev = Redacted.make(typeof DEV !== "undefined" ? DEV.toString() : "false");
  return Redacted.value(isDev) === "true" ? LogLevel.Debug : LogLevel.Info;
};

const withStructured = <A, E>(effect: Effect.Effect<A, E>) => {
  return effect.pipe(
    Logger.withMinimumLogLevel(getMinLogLevel()),
    Effect.provide(Logger.structured),
  );
};

export const runServerEffect = <A, E>(effect: Effect.Effect<A, E>) => {
  return Effect.runPromise(withStructured(effect));
};

const withLogContext = <A, E>(ctx: LogContext, effect: Effect.Effect<A, E>) => {
  return effect.pipe(
    Effect.annotateLogs({
      ...(ctx.sessionId ? { sessionId: ctx.sessionId } : {}),
      ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
      ...(ctx.module ? { module: ctx.module } : {}),
    }),
  );
};

export const withActionLogs = <A, E>(name: string, effect: Effect.Effect<A, E>) => {
  return Effect.gen(function* () {
    yield* Effect.logInfo(`${name}:start`);
    return yield* effect.pipe(
      Effect.tap(() => Effect.logDebug(`${name}:success`)),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logError(`${name}:error`, error);
          return yield* Effect.fail(error);
        }),
      ),
    );
  });
};

const forwardError = (message: string, error?: unknown) => {
  if (!errorRef.current) {
    return;
  }

  const promise = errorRef.current(message, error);
  if (waitRef.current) {
    waitRef.current(promise);
  }
};

const runLog = (effect: Effect.Effect<void>) => {
  Effect.runFork(withStructured(effect));
};

export const logger = {
  info: (message: string, ...args: unknown[]) => {
    runLog(Effect.logInfo(message, ...args));
  },
  debug: (message: string, ...args: unknown[]) => {
    runLog(Effect.logDebug(message, ...args));
  },
  warn: (message: string, ...args: unknown[]) => {
    runLog(Effect.logWarning(message, ...args));
  },
  error: (message: string, ...args: unknown[]) => {
    runLog(Effect.logError(message, ...args));
    forwardError(message, args[0]);
  },
  log: (message: string, ...args: unknown[]) => {
    runLog(Effect.log(message, ...args));
  },
};

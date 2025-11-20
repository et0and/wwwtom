import { Effect, Logger, LogLevel } from "effect";

/**
 * Configuration for the logger
 */
const getMinLogLevel = () => {
	return import.meta.env.DEV ? LogLevel.Debug : LogLevel.Info;
};

export const runServerEffect = <A, E>(effect: Effect.Effect<A, E>) => {
	return Effect.runPromise(
		effect.pipe(Logger.withMinimumLogLevel(getMinLogLevel())),
	);
};

/**
 * Logging utilities
 */
export const logger = {
	info: (message: string, ...args: unknown[]) =>
		Effect.logInfo(message, ...args),
	debug: (message: string, ...args: unknown[]) =>
		Effect.logDebug(message, ...args),
	warn: (message: string, ...args: unknown[]) =>
		Effect.logWarning(message, ...args),
	error: (message: string, ...args: unknown[]) =>
		Effect.logError(message, ...args),
	// Generic log
	log: (message: string, ...args: unknown[]) => Effect.log(message, ...args),
};

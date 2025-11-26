import { Effect, Logger, LogLevel } from "effect";

/**
 * Configuration for the logger
 */
const getMinLogLevel = () => {
	return import.meta.env.DEV ? LogLevel.Debug : LogLevel.Info;
};

/**
 * Executes a server-side Effect with logging configuration.
 *
 * This function runs an Effect as a Promise while applying the minimum log level
 * configuration. It's designed to be used in server environments where you need
 * to execute effects with proper logging setup.
 *
 * @template A - The success type of the Effect
 * @template E - The error type of the Effect
 *
 * @param {Effect.Effect<A, E>} effect - The Effect to be executed
 *
 * @returns {Promise<A>} A Promise that resolves with the Effect's success value
 *
 * @throws {E} Throws the error type E if the Effect fails
 *
 * @example
 * ```typescript
 * // Simple effect execution
 * const myEffect = Effect.succeed("Hello, World!");
 * const result = await runServerEffect(myEffect);
 * console.log(result); // "Hello, World!"
 * ```
 *
 * @example
 * ```typescript
 * // Effect with logging
 * const processEffect = Effect.gen(function* (_) {
 *   yield* _(Effect.log("Starting process..."));
 *   const result = yield* _(Effect.succeed(42));
 *   yield* _(Effect.log(`Process completed with result: ${result}`));
 *   return result;
 * });
 *
 * const output = await runServerEffect(processEffect);
 * // Logs will be filtered based on the minimum log level from getMinLogLevel()
 * ```
 */
export const runServerEffect = <A, E>(effect: Effect.Effect<A, E>) => {
	return Effect.runPromise(
		effect.pipe(Logger.withMinimumLogLevel(getMinLogLevel())),
	);
};

/**
 * Logging utilities
 */
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
	// Generic log
	log: (message: string, ...args: unknown[]) => {
		Effect.runPromise(Effect.log(message, ...args));
	},
};

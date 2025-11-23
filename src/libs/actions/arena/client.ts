import { getRequestEvent } from "solid-js/web";
import { Effect } from "effect";
import { logger, runServerEffect } from "~/libs/utils/logger";
import { ArenaClient } from "~/libs/services/arena";

/**
 * Server-side Arena client wrapper that uses environment variables
 * and provides error handling via Effect.
 *
 * This function creates an ArenaClient instance by resolving the ARENA_TOKEN
 * from multiple possible sources in order of precedence:
 * 1. Cloudflare Workers environment variables
 * 2. Node.js process environment variables (for development)
 * 3. Vite import.meta.env (for local development)
 *
 * @returns Effect that either succeeds with an ArenaClient or fails with an Error
 */
export function getArenaClient(): Effect.Effect<ArenaClient, Error> {
	"use server";

	// Effect.gen allows for imperative-style programming with Effect
	return Effect.gen(function* () {
		// Get the current SolidJS request event to access Cloudflare environment
		const event = getRequestEvent();
		const env = event?.nativeEvent.context.cloudflare?.env as
			| { ARENA_TOKEN: string }
			| undefined;

		// Resolve ARENA_TOKEN from multiple sources with fallback chain
		const ARENA_TOKEN: string | undefined =
			env?.ARENA_TOKEN ||
			(typeof process !== "undefined" ? process.env?.ARENA_TOKEN : undefined) ||
			import.meta.env.ARENA_TOKEN;

		// Ensure we have a token. This is needed for anything to do with users and comments in are.na.
		if (!ARENA_TOKEN) {
			const error = new Error("ARENA_TOKEN environment variable is not set");
			yield* Effect.sync(() =>
				runServerEffect(logger.error("Configuration error", error)),
			);
			return yield* Effect.fail(error);
		}

		yield* Effect.sync(() =>
			runServerEffect(logger.debug("Initializing Arena client")),
		);

		// Create and return the ArenaClient instance
		return new ArenaClient({ token: ARENA_TOKEN });
	});
}

/**
 * Generic fetch wrapper for Are.na API calls with error handling and logging.
 *
 * @template T - The return type of the operation
 * @param operation - A function that takes an ArenaClient and returns a Promise of type T
 * @param operationName - Human-readable name for logging purposes
 * @returns Effect that either succeeds with operation result or fails with an Error
 *
 * @example
 * ```typescript
 * // Example: Fetch a user's channels from Arena
 * const channelsEffect = fetchArena(
 *   (client) => client.getChannels("user-123"),
 *   "get user channels"
 * );
 *
 * // Execute the effect and handle the result
 * const result = await runServerEffect(channelsEffect);
 * // result will be either Channel[] on success or Error on failure
 * ```
 */
export function fetchArena<T>(
	operation: (client: ArenaClient) => Promise<T>,
	operationName: string,
): Effect.Effect<T, Error> {
	"use server";

	// Effect.flatMap chains operations: first get client, then execute operation
	return Effect.flatMap(getArenaClient(), (client) =>
		Effect.gen(function* () {
			// Log the start of the operation for debugging and monitoring
			yield* Effect.sync(() =>
				runServerEffect(logger.debug(`Arena operation: ${operationName}`)),
			);

			// Effect.tryPromise safely wraps Promise-based operations in Effect context
			// Converts promise rejections to typed Error instances
			return yield* Effect.tryPromise({
				try: () => operation(client),
				catch: (e) =>
					e instanceof Error ? e : new Error("Unknown Arena API error"),
			});
		}),
	).pipe(
		// Effect.catchAll handles all error cases from the operation
		Effect.catchAll((error) =>
			Effect.gen(function* () {
				// Log the error with operation context for debugging
				yield* Effect.sync(() =>
					runServerEffect(
						logger.error(`Arena operation failed: ${operationName}`, error),
					),
				);
				// Propagate the error to the caller
				return yield* Effect.fail(error);
			}),
		),
	);
}

import { getRequestEvent } from "solid-js/web";
import { Effect } from "effect";
import { ArenaClient, HttpError } from "~/libs/services/arena";
import { ArenaConfigError } from "~/libs/types/errors";

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
 * @returns Effect that either succeeds with an ArenaClient or fails with an ArenaConfigError
 */
export function getArenaClient(): Effect.Effect<ArenaClient, ArenaConfigError> {
	"use server";

	return Effect.gen(function* () {
		const event = getRequestEvent();
		const env = event?.nativeEvent.context.cloudflare?.env as
			| { ARENA_TOKEN: string }
			| undefined;

		const token: string | undefined =
			env?.ARENA_TOKEN ||
			(typeof process !== "undefined" ? process.env?.ARENA_TOKEN : undefined) ||
			import.meta.env.ARENA_TOKEN;

		if (!token) {
			yield* Effect.logError("ARENA_TOKEN environment variable is not set");
			return yield* Effect.fail(
				new ArenaConfigError({
					message: "ARENA_TOKEN environment variable is not set",
				}),
			);
		}

		yield* Effect.logDebug("Initializing Arena client");
		return new ArenaClient({ token });
	});
}

/**
 * Generic wrapper for Are.na API calls with error handling and logging.
 *
 * @template T - The return type of the operation
 * @param operation - A function that takes an ArenaClient and returns an Effect
 * @param name - Human-readable name for logging purposes
 * @returns Effect that either succeeds with operation result or fails with an error
 *
 * @example
 * ```typescript
 * const channelsEffect = fetchArena(
 *   (client) => client.channel("my-channel").contents(),
 *   "get channel contents"
 * );
 *
 * const result = await runServerEffect(channelsEffect);
 * ```
 */
export function fetchArena<T>(
	operation: (client: ArenaClient) => Effect.Effect<T, HttpError>,
	name: string,
): Effect.Effect<T, ArenaConfigError | HttpError> {
	"use server";

	return getArenaClient().pipe(
		Effect.flatMap((client) =>
			Effect.gen(function* () {
				yield* Effect.logDebug(`Arena operation: ${name}`);
				return yield* operation(client);
			}),
		),
		Effect.catchAll((error) =>
			Effect.gen(function* () {
				yield* Effect.logError(`Arena operation failed: ${name}`, error);
				return yield* Effect.fail(error);
			}),
		),
	);
}

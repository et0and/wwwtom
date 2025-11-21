import { getRequestEvent } from "solid-js/web";
import { ResultAsync, errAsync } from "neverthrow";
import { logger, runServerEffect } from "~/libs/utils/logger";
import { ArenaClient } from "~/libs/services/arena";

/**
 * Server-side Arena client wrapper that uses environment variables
 * and provides error handling via Neverthrow.
 */
export function getArenaClient(): ResultAsync<ArenaClient, Error> {
	"use server";

	const event = getRequestEvent();
	const env = event?.nativeEvent.context.cloudflare?.env as
		| { ARENA_TOKEN?: string }
		| undefined;

	const ARENA_TOKEN: string | undefined =
		env?.ARENA_TOKEN ||
		(typeof process !== "undefined" ? process.env?.ARENA_TOKEN : undefined) ||
		import.meta.env.ARENA_TOKEN;

	/* TODO @et0and get a token for this
	if (!ARENA_TOKEN) {
		const error = new Error("ARENA_TOKEN environment variable is not set");
		runServerEffect(logger.error("Configuration error", error));
		return errAsync(error);
	} */

	runServerEffect(logger.debug("Initializing Arena client"));

	return ResultAsync.fromSafePromise(
		Promise.resolve(new ArenaClient({ token: ARENA_TOKEN })),
	);
}

/**
 * Generic wrapper for Arena API calls with error handling and logging.
 */
export function fetchArena<T>(
	operation: (client: ArenaClient) => Promise<T>,
	operationName: string,
): ResultAsync<T, Error> {
	"use server";

	return getArenaClient()
		.andThen((client) => {
			runServerEffect(logger.debug(`Arena operation: ${operationName}`));
			return ResultAsync.fromPromise(operation(client), (e) =>
				e instanceof Error ? e : new Error("Unknown Arena API error"),
			);
		})
		.mapErr((error) => {
			runServerEffect(
				logger.error(`Arena operation failed: ${operationName}`, error),
			);
			return error;
		});
}

"use server";

import { query } from "@solidjs/router";
import { Effect } from "effect";
import { ArenaService, type ArenaServiceShape } from "@tom/arena/service";
import type { PaginationAttributes } from "@tom/arena";
import { retryPolicy } from "@tom/utils";
import { runEffect, getServiceLayer } from "~/libs/runtime";

type ArenaCall<T> = (arena: ArenaServiceShape) => Effect.Effect<T, unknown>;

const createArenaQuery = <T, Args extends unknown[]>(
	name: string,
	cacheKey: string,
	makeCall: (...args: Args) => ArenaCall<T>,
	getLogId: (...args: Args) => string | number = () => "",
) =>
	query(async (...args: Args) => {
		"use server";
		const layer = getServiceLayer();
		const logId = getLogId(...args);
		const logPrefix = logId ? `${name}:${logId}` : name;
		return runEffect(
			Effect.gen(function* () {
				const arena = yield* ArenaService;
				yield* Effect.logInfo(`${logPrefix}:start`);
				const result = yield* makeCall(...args)(arena).pipe(Effect.retry(retryPolicy));
				yield* Effect.logInfo(`${logPrefix}:success`);
				return result;
			}),
			layer,
		);
	}, cacheKey);

/**
 * Fetches a block by ID including its connections to channels.
 * @param id - The block ID
 * @returns A promise that resolves to block data
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { getBlock } from "~/libs/actions/arena/blocks";
 * const block = createAsync(() => getBlock(12345));
 * ```
 */
export const getBlock = createArenaQuery(
	"getBlock",
	"arena-block",
	(id: number) => (arena) => arena.client.block(id).get(),
	(id) => id,
);

/**
 * Fetches all channels that a block appears in.
 * @param id - The block ID
 * @param options - Optional pagination parameters
 * @returns A promise that resolves to channels containing the block
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { getBlockChannels } from "~/libs/actions/arena/blocks";
 * const channels = createAsync(() => getBlockChannels(12345));
 * ```
 */
export const getBlockChannels = createArenaQuery(
	"getBlockChannels",
	"arena-block-channels",
	(id: number, options?: PaginationAttributes) => (arena) =>
		arena.client.block(id).channels(options),
	(id) => id,
);

/**
 * Fetches comments for a block.
 * @param id - The block ID
 * @param options - Optional pagination parameters
 * @returns A promise that resolves to block comments
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { getBlockComments } from "~/libs/actions/arena/blocks";
 * const comments = createAsync(() => getBlockComments(12345));
 * ```
 */
export const getBlockComments = createArenaQuery(
	"getBlockComments",
	"arena-block-comments",
	(id: number, options?: PaginationAttributes) => (arena) =>
		arena.client.block(id).comments(options),
	(id) => id,
);

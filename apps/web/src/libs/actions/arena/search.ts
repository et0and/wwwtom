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
 * Searches across all Arena content (blocks, channels, users).
 * @param searchQuery - The search query string
 * @param options - Optional pagination parameters
 * @returns A promise that resolves to search results
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { searchEverything } from "~/libs/actions/arena/search";
 * const results = createAsync(() => searchEverything("design"));
 * ```
 */
export const searchEverything = createArenaQuery(
	"searchEverything",
	"arena-search-everything",
	(searchQuery: string, options?: PaginationAttributes) => (arena) =>
		arena.client.search.everything(searchQuery, options),
	(query) => query,
);

/**
 * Searches for channels matching the query.
 * @param searchQuery - The search query string
 * @param options - Optional pagination parameters
 * @returns A promise that resolves to channel search results
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { searchChannels } from "~/libs/actions/arena/search";
 * const results = createAsync(() => searchChannels("typography"));
 * ```
 */
export const searchChannels = createArenaQuery(
	"searchChannels",
	"arena-search-channels",
	(searchQuery: string, options?: PaginationAttributes) => (arena) =>
		arena.client.search.channels(searchQuery, options),
	(query) => query,
);

/**
 * Searches for blocks matching the query.
 * @param searchQuery - The search query string
 * @param options - Optional pagination parameters
 * @returns A promise that resolves to block search results
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { searchBlocks } from "~/libs/actions/arena/search";
 * const results = createAsync(() => searchBlocks("architecture"));
 * ```
 */
export const searchBlocks = createArenaQuery(
	"searchBlocks",
	"arena-search-blocks",
	(searchQuery: string, options?: PaginationAttributes) => (arena) =>
		arena.client.search.blocks(searchQuery, options),
	(query) => query,
);

/**
 * Searches for users matching the query.
 * @param searchQuery - The search query string
 * @param options - Optional pagination parameters
 * @returns A promise that resolves to user search results
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { searchUsers } from "~/libs/actions/arena/search";
 * const results = createAsync(() => searchUsers("designer"));
 * ```
 */
export const searchUsers = createArenaQuery(
	"searchUsers",
	"arena-search-users",
	(searchQuery: string, options?: PaginationAttributes) => (arena) =>
		arena.client.search.users(searchQuery, options),
	(query) => query,
);

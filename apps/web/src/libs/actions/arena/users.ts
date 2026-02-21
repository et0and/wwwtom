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
 * Fetches user profile information by ID or slug.
 * @param id - The user ID or slug
 * @returns A promise that resolves to user data
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { getUser } from "~/libs/actions/arena/users";
 * const user = createAsync(() => getUser("username"));
 * ```
 */
export const getUser = createArenaQuery(
	"getUser",
	"arena-user",
	(id: number | string) => (arena) => arena.client.user(id).get(),
	(id) => id,
);

/**
 * Fetches channels owned or collaborated on by a user.
 * @param id - The user ID or slug
 * @param options - Optional pagination parameters
 * @returns A promise that resolves to user channels
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { getUserChannels } from "~/libs/actions/arena/users";
 * const channels = createAsync(() => getUserChannels("username"));
 * ```
 */
export const getUserChannels = createArenaQuery(
	"getUserChannels",
	"arena-user-channels",
	(id: number | string, options?: PaginationAttributes) => (arena) =>
		arena.client.user(id).channels(options),
	(id) => id,
);

/**
 * Fetches users that the specified user is following.
 * @param id - The user ID or slug
 * @returns A promise that resolves to following data
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { getUserFollowing } from "~/libs/actions/arena/users";
 * const following = createAsync(() => getUserFollowing("username"));
 * ```
 */
export const getUserFollowing = createArenaQuery(
	"getUserFollowing",
	"arena-user-following",
	(id: number | string) => (arena) => arena.client.user(id).following(),
	(id) => id,
);

/**
 * Fetches users following the specified user.
 * @param id - The user ID or slug
 * @returns A promise that resolves to followers data
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { getUserFollowers } from "~/libs/actions/arena/users";
 * const followers = createAsync(() => getUserFollowers("username"));
 * ```
 */
export const getUserFollowers = createArenaQuery(
	"getUserFollowers",
	"arena-user-followers",
	(id: number | string) => (arena) => arena.client.user(id).followers(),
	(id) => id,
);

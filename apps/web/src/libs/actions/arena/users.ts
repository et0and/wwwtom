import { query } from "@solidjs/router";
import { Effect } from "effect";
import { ArenaService } from "@tom/arena/service";
import type { PaginationAttributes } from "@tom/arena";
import { retryPolicy } from "@tom/utils";
import { runEffect, getServiceLayer } from "~/libs/runtime";

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
export const getUser = query(async (id: number | string) => {
  "use server";
  const layer = getServiceLayer();
  return runEffect(
    Effect.gen(function* () {
      const arena = yield* Effect.service(ArenaService);
      yield* Effect.logInfo(`getUser:${id}:start`);
      const result = yield* arena.client.user(id).get().pipe(Effect.retry(retryPolicy));
      yield* Effect.logInfo(`getUser:${id}:success`);
      return result;
    }),
    layer,
  );
}, "arena-user");

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
export const getUserChannels = query(
  async (id: number | string, options?: PaginationAttributes) => {
    "use server";
    const layer = getServiceLayer();
    return runEffect(
      Effect.gen(function* () {
        const arena = yield* Effect.service(ArenaService);
        yield* Effect.logInfo(`getUserChannels:${id}:start`);
        const result = yield* arena.client
          .user(id)
          .channels(options)
          .pipe(Effect.retry(retryPolicy));
        yield* Effect.logInfo(`getUserChannels:${id}:success`);
        return result;
      }),
      layer,
    );
  },
  "arena-user-channels",
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
export const getUserFollowing = query(async (id: number | string) => {
  "use server";
  const layer = getServiceLayer();
  return runEffect(
    Effect.gen(function* () {
      const arena = yield* Effect.service(ArenaService);
      yield* Effect.logInfo(`getUserFollowing:${id}:start`);
      const result = yield* arena.client.user(id).following().pipe(Effect.retry(retryPolicy));
      yield* Effect.logInfo(`getUserFollowing:${id}:success`);
      return result;
    }),
    layer,
  );
}, "arena-user-following");

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
export const getUserFollowers = query(async (id: number | string) => {
  "use server";
  const layer = getServiceLayer();
  return runEffect(
    Effect.gen(function* () {
      const arena = yield* Effect.service(ArenaService);
      yield* Effect.logInfo(`getUserFollowers:${id}:start`);
      const result = yield* arena.client.user(id).followers().pipe(Effect.retry(retryPolicy));
      yield* Effect.logInfo(`getUserFollowers:${id}:success`);
      return result;
    }),
    layer,
  );
}, "arena-user-followers");

import { query } from "@solidjs/router";
import { fetchArena } from "./client";
import { makeScopedRunner, withActionLogs } from "@tom/utils";
import type { PaginationAttributes } from "@tom/arena";

const scope = "wwwtom:apps:web:arena:users";
const run = makeScopedRunner(scope);

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
  return run(
    withActionLogs(
      `getUser:${id}`,
      fetchArena((client) => client.user(id).get(), `getUser(${id})`),
    ),
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
    return run(
      withActionLogs(
        `getUserChannels:${id}`,
        fetchArena((client) => client.user(id).channels(options), `getUserChannels(${id})`),
      ),
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
  return run(
    withActionLogs(
      `getUserFollowing:${id}`,
      fetchArena((client) => client.user(id).following(), `getUserFollowing(${id})`),
    ),
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
  return run(
    withActionLogs(
      `getUserFollowers:${id}`,
      fetchArena((client) => client.user(id).followers(), `getUserFollowers(${id})`),
    ),
  );
}, "arena-user-followers");

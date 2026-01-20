import { query } from "@solidjs/router";
import { fetchArena } from "./client";
import { makeScopedRunner, withActionLogs } from "@tom/utils";
import type { PaginationAttributes } from "@tom/arena";

const scope = "wwwtom:apps:web:arena:search";
const run = makeScopedRunner(scope);

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
export const searchEverything = query(
  async (searchQuery: string, options?: PaginationAttributes) => {
    "use server";
    return run(
      withActionLogs(
        `searchEverything:${searchQuery}`,
        fetchArena(
          (client) => client.search.everything(searchQuery, options),
          `searchEverything("${searchQuery}")`,
        ),
      ),
    );
  },
  "arena-search-everything",
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
export const searchChannels = query(async (searchQuery: string, options?: PaginationAttributes) => {
  "use server";
  return run(
    withActionLogs(
      `searchChannels:${searchQuery}`,
      fetchArena(
        (client) => client.search.channels(searchQuery, options),
        `searchChannels("${searchQuery}")`,
      ),
    ),
  );
}, "arena-search-channels");

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
export const searchBlocks = query(async (searchQuery: string, options?: PaginationAttributes) => {
  "use server";
  return run(
    withActionLogs(
      `searchBlocks:${searchQuery}`,
      fetchArena(
        (client) => client.search.blocks(searchQuery, options),
        `searchBlocks("${searchQuery}")`,
      ),
    ),
  );
}, "arena-search-blocks");

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
export const searchUsers = query(async (searchQuery: string, options?: PaginationAttributes) => {
  "use server";
  return run(
    withActionLogs(
      `searchUsers:${searchQuery}`,
      fetchArena(
        (client) => client.search.users(searchQuery, options),
        `searchUsers("${searchQuery}")`,
      ),
    ),
  );
}, "arena-search-users");

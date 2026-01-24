import { query } from "@solidjs/router";
import { Effect } from "effect";
import { ArenaService } from "@tom/arena/service";
import type { PaginationAttributes } from "@tom/arena";
import { retryPolicy } from "@tom/utils";
import { runEffect } from "~/libs/runtime";

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
    return runEffect(
      Effect.gen(function* () {
        const arena = yield* ArenaService;
        yield* Effect.logInfo(`searchEverything:${searchQuery}:start`);
        const result = yield* arena.client.search
          .everything(searchQuery, options)
          .pipe(Effect.retry(retryPolicy));
        yield* Effect.logInfo(`searchEverything:${searchQuery}:success`);
        return result;
      }),
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
  return runEffect(
    Effect.gen(function* () {
      const arena = yield* ArenaService;
      yield* Effect.logInfo(`searchChannels:${searchQuery}:start`);
      const result = yield* arena.client.search
        .channels(searchQuery, options)
        .pipe(Effect.retry(retryPolicy));
      yield* Effect.logInfo(`searchChannels:${searchQuery}:success`);
      return result;
    }),
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
  return runEffect(
    Effect.gen(function* () {
      const arena = yield* ArenaService;
      yield* Effect.logInfo(`searchBlocks:${searchQuery}:start`);
      const result = yield* arena.client.search
        .blocks(searchQuery, options)
        .pipe(Effect.retry(retryPolicy));
      yield* Effect.logInfo(`searchBlocks:${searchQuery}:success`);
      return result;
    }),
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
  return runEffect(
    Effect.gen(function* () {
      const arena = yield* ArenaService;
      yield* Effect.logInfo(`searchUsers:${searchQuery}:start`);
      const result = yield* arena.client.search
        .users(searchQuery, options)
        .pipe(Effect.retry(retryPolicy));
      yield* Effect.logInfo(`searchUsers:${searchQuery}:success`);
      return result;
    }),
  );
}, "arena-search-users");

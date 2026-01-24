import { query } from "@solidjs/router";
import { Effect } from "effect";
import { ArenaService } from "@tom/arena/service";
import type { PaginationAttributes } from "@tom/arena";
import { retryPolicy } from "@tom/utils";
import { runEffect } from "~/libs/runtime";

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
export const getBlock = query(async (id: number) => {
  "use server";

  return runEffect(
    Effect.gen(function* () {
      const arena = yield* ArenaService;
      yield* Effect.logInfo(`getBlock:${id}:start`);
      const result = yield* arena.client.block(id).get().pipe(Effect.retry(retryPolicy));
      yield* Effect.logInfo(`getBlock:${id}:success`);
      return result;
    }),
  );
}, "arena-block");

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
export const getBlockChannels = query(async (id: number, options?: PaginationAttributes) => {
  "use server";

  return runEffect(
    Effect.gen(function* () {
      const arena = yield* ArenaService;
      yield* Effect.logInfo(`getBlockChannels:${id}:start`);
      const result = yield* arena.client
        .block(id)
        .channels(options)
        .pipe(Effect.retry(retryPolicy));
      yield* Effect.logInfo(`getBlockChannels:${id}:success`);
      return result;
    }),
  );
}, "arena-block-channels");

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
export const getBlockComments = query(async (id: number, options?: PaginationAttributes) => {
  "use server";

  return runEffect(
    Effect.gen(function* () {
      const arena = yield* ArenaService;
      yield* Effect.logInfo(`getBlockComments:${id}:start`);
      const result = yield* arena.client
        .block(id)
        .comments(options)
        .pipe(Effect.retry(retryPolicy));
      yield* Effect.logInfo(`getBlockComments:${id}:success`);
      return result;
    }),
  );
}, "arena-block-comments");

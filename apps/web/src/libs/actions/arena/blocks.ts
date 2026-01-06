import { query } from "@solidjs/router";
import { fetchArena } from "./client";
import { runServerEffect } from "@tom/utils";
import type { PaginationAttributes } from "@tom/arena";

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
  return runServerEffect(fetchArena((client) => client.block(id).get(), `getBlock(${id})`));
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
  return runServerEffect(
    fetchArena((client) => client.block(id).channels(options), `getBlockChannels(${id})`),
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
  return runServerEffect(
    fetchArena((client) => client.block(id).comments(options), `getBlockComments(${id})`),
  );
}, "arena-block-comments");

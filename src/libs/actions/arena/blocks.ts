import { query } from "@solidjs/router";
import { fetchArena } from "./client";
import type { PaginationAttributes } from "~/libs/types/arena";

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
	return fetchArena(
		(client) => client.block(id).get(),
		`getBlock(${id})`,
	).match(
		(data) => data,
		(error) => {
			throw error;
		},
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
export const getBlockChannels = query(
	async (id: number, options?: PaginationAttributes) => {
		"use server";
		return fetchArena(
			(client) => client.block(id).channels(options),
			`getBlockChannels(${id})`,
		).match(
			(data) => data,
			(error) => {
				throw error;
			},
		);
	},
	"arena-block-channels",
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
export const getBlockComments = query(
	async (id: number, options?: PaginationAttributes) => {
		"use server";
		return fetchArena(
			(client) => client.block(id).comments(options),
			`getBlockComments(${id})`,
		).match(
			(data) => data,
			(error) => {
				throw error;
			},
		);
	},
	"arena-block-comments",
);

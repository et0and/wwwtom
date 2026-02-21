"use server";

import type { PaginationAttributes } from "@tom/arena";
import type { GetChannelContentsApiResponse } from "@tom/schemas";
import { createArenaQuery } from "./factory";

/**
 * Fetches a channel by slug with optional pagination for its contents.
 * @param slug - The channel slug
 * @param options - Optional pagination parameters
 * @returns A promise that resolves to channel data
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { getChannel } from "~/libs/actions/arena/channels";
 * const channel = createAsync(() => getChannel("my-channel"));
 * ```
 */
export const getChannel = createArenaQuery(
	"getChannel",
	"arena-channel",
	(slug: string, options?: PaginationAttributes) => (arena) =>
		arena.client.channel(slug).get(options),
	(slug) => slug,
);

/**
 * Fetches channel contents (blocks and nested channels) with pagination.
 * @param slug - The channel slug
 * @param options - Optional pagination parameters
 * @returns A promise that resolves to channel contents
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { getChannelContents } from "~/libs/actions/arena/channels";
 * const contents = createAsync(() => getChannelContents("my-channel", { per: 100 }));
 * ```
 */
export const getChannelContents = createArenaQuery<
	GetChannelContentsApiResponse,
	[string, PaginationAttributes?]
>(
	"getChannelContents",
	"arena-channel-contents",
	(slug, options) => (arena) => arena.client.channel(slug).contents(options),
	(slug) => slug,
);

/**
 * Fetches the thumbnail representation of a channel (limited contents).
 * @param slug - The channel slug
 * @returns A promise that resolves to channel thumbnail data
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { getChannelThumb } from "~/libs/actions/arena/channels";
 * const thumb = createAsync(() => getChannelThumb("my-channel"));
 * ```
 */
export const getChannelThumb = createArenaQuery(
	"getChannelThumb",
	"arena-channel-thumb",
	(slug: string) => (arena) => arena.client.channel(slug).thumb(),
	(slug) => slug,
);

/**
 * Fetches all channels for the authenticated user.
 * @param options - Optional pagination parameters
 * @returns A promise that resolves to an array of channels
 * @example
 * ```typescript
 * import { createAsync } from "@solidjs/router";
 * import { getChannels } from "~/libs/actions/arena/channels";
 * const channels = createAsync(() => getChannels({ per: 50 }));
 * ```
 */
export const getChannels = createArenaQuery(
	"getChannels",
	"arena-channels",
	(options?: PaginationAttributes) => (arena) => arena.client.channels(options),
);

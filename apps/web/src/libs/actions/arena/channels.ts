import { query } from "@solidjs/router";
import { Effect } from "effect";
import { ArenaService } from "@tom/arena/service";
import type { PaginationAttributes } from "@tom/arena";
import { retryPolicy } from "@tom/utils";
import { runEffect } from "~/libs/runtime";

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
export const getChannel = query(async (slug: string, options?: PaginationAttributes) => {
  "use server";
  return runEffect(
    Effect.gen(function* () {
      const arena = yield* ArenaService;
      yield* Effect.logInfo(`getChannel:${slug}:start`);
      const result = yield* arena.client.channel(slug).get(options).pipe(Effect.retry(retryPolicy));
      yield* Effect.logInfo(`getChannel:${slug}:success`);
      return result;
    }),
  );
}, "arena-channel");

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
export const getChannelContents = query(async (slug: string, options?: PaginationAttributes) => {
  "use server";
  return runEffect(
    Effect.gen(function* () {
      const arena = yield* ArenaService;
      yield* Effect.logInfo(`getChannelContents:${slug}:start`);
      const result = yield* arena.client
        .channel(slug)
        .contents(options)
        .pipe(Effect.retry(retryPolicy));
      yield* Effect.logInfo(`getChannelContents:${slug}:success`);
      return result;
    }),
  );
}, "arena-channel-contents");

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
export const getChannelThumb = query(async (slug: string) => {
  "use server";
  return runEffect(
    Effect.gen(function* () {
      const arena = yield* ArenaService;
      yield* Effect.logInfo(`getChannelThumb:${slug}:start`);
      const result = yield* arena.client.channel(slug).thumb().pipe(Effect.retry(retryPolicy));
      yield* Effect.logInfo(`getChannelThumb:${slug}:success`);
      return result;
    }),
  );
}, "arena-channel-thumb");

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
export const getChannels = query(async (options?: PaginationAttributes) => {
  "use server";
  return runEffect(
    Effect.gen(function* () {
      const arena = yield* ArenaService;
      yield* Effect.logInfo("getChannels:start");
      const result = yield* arena.client.channels(options).pipe(Effect.retry(retryPolicy));
      yield* Effect.logInfo("getChannels:success");
      return result;
    }),
  );
}, "arena-channels");

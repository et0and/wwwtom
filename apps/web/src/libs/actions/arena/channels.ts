import { Effect } from "effect";
import { ArenaService } from "@tom/arena/service";
import type { PaginationAttributes } from "@tom/arena";
import { retryPolicy } from "@tom/utils";
import { runEffect, getServiceLayer } from "~/libs/runtime";

export const getChannel = async (slug: string, options?: PaginationAttributes) => {
  "use server";
  const layer = getServiceLayer();
  return runEffect(
    ArenaService.pipe(
      Effect.andThen((arena) =>
        arena.publicClient.channel(slug).get(options).pipe(Effect.retry(retryPolicy)),
      ),
    ),
    layer,
  );
};

export const getChannelContents = async (slug: string, options?: PaginationAttributes) => {
  "use server";
  const layer = getServiceLayer();
  return runEffect(
    ArenaService.pipe(
      Effect.andThen((arena) =>
        arena.publicClient.channel(slug).contents(options).pipe(Effect.retry(retryPolicy)),
      ),
      Effect.tap(() => Effect.logInfo(`getChannelContents:${slug}:success`)),
    ),
    layer,
  );
};

export const getChannelThumb = async (slug: string) => {
  "use server";
  const layer = getServiceLayer();
  return runEffect(
    ArenaService.pipe(
      Effect.andThen((arena) =>
        arena.publicClient.channel(slug).thumb().pipe(Effect.retry(retryPolicy)),
      ),
    ),
    layer,
  );
};

export const getChannels = async (options?: PaginationAttributes) => {
  "use server";
  const layer = getServiceLayer();
  return runEffect(
    ArenaService.pipe(
      Effect.andThen((arena) =>
        arena.client.channels(options).pipe(Effect.retry(retryPolicy)),
      ),
    ),
    layer,
  );
};

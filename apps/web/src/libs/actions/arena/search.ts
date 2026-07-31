import { Effect } from "effect";
import { ArenaService } from "@tom/arena/service";
import type { PaginationAttributes } from "@tom/arena";
import { retryPolicy } from "@tom/utils";
import { runEffect, getServiceLayer } from "~/libs/runtime";

export const searchEverything = async (searchQuery: string, options?: PaginationAttributes) => {
  "use server";
  const layer = getServiceLayer();
  return runEffect(
    ArenaService.pipe(
      Effect.tap(() => Effect.logInfo(`searchEverything:${searchQuery}:start`)),
      Effect.andThen((arena) =>
        arena.client.search.everything(searchQuery, options).pipe(Effect.retry(retryPolicy)),
      ),
      Effect.tap(() => Effect.logInfo(`searchEverything:${searchQuery}:success`)),
    ),
    layer,
  );
};

export const searchChannels = async (searchQuery: string, options?: PaginationAttributes) => {
  "use server";
  const layer = getServiceLayer();
  return runEffect(
    ArenaService.pipe(
      Effect.tap(() => Effect.logInfo(`searchChannels:${searchQuery}:start`)),
      Effect.andThen((arena) =>
        arena.client.search.channels(searchQuery, options).pipe(Effect.retry(retryPolicy)),
      ),
      Effect.tap(() => Effect.logInfo(`searchChannels:${searchQuery}:success`)),
    ),
    layer,
  );
};

export const searchBlocks = async (searchQuery: string, options?: PaginationAttributes) => {
  "use server";
  const layer = getServiceLayer();
  return runEffect(
    ArenaService.pipe(
      Effect.tap(() => Effect.logInfo(`searchBlocks:${searchQuery}:start`)),
      Effect.andThen((arena) =>
        arena.client.search.blocks(searchQuery, options).pipe(Effect.retry(retryPolicy)),
      ),
      Effect.tap(() => Effect.logInfo(`searchBlocks:${searchQuery}:success`)),
    ),
    layer,
  );
};

export const searchUsers = async (searchQuery: string, options?: PaginationAttributes) => {
  "use server";
  const layer = getServiceLayer();
  return runEffect(
    ArenaService.pipe(
      Effect.tap(() => Effect.logInfo(`searchUsers:${searchQuery}:start`)),
      Effect.andThen((arena) =>
        arena.client.search.users(searchQuery, options).pipe(Effect.retry(retryPolicy)),
      ),
      Effect.tap(() => Effect.logInfo(`searchUsers:${searchQuery}:success`)),
    ),
    layer,
  );
};

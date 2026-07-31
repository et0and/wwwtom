import { Effect } from "effect";
import { ArenaService } from "@tom/arena/service";
import type { PaginationAttributes } from "@tom/arena";
import { retryPolicy } from "@tom/utils";
import { runEffect, getServiceLayer } from "~/libs/runtime";

export const getBlock = async (id: number) => {
  "use server";
  const layer = getServiceLayer();
  return runEffect(
    ArenaService.pipe(
      Effect.tap(() => Effect.logInfo(`getBlock:${id}:start`)),
      Effect.andThen((arena) =>
        arena.client.block(id).get().pipe(Effect.retry(retryPolicy)),
      ),
      Effect.tap(() => Effect.logInfo(`getBlock:${id}:success`)),
    ),
    layer,
  );
};

export const getBlockChannels = async (id: number, options?: PaginationAttributes) => {
  "use server";
  const layer = getServiceLayer();
  return runEffect(
    ArenaService.pipe(
      Effect.tap(() => Effect.logInfo(`getBlockChannels:${id}:start`)),
      Effect.andThen((arena) =>
        arena.client.block(id).channels(options).pipe(Effect.retry(retryPolicy)),
      ),
      Effect.tap(() => Effect.logInfo(`getBlockChannels:${id}:success`)),
    ),
    layer,
  );
};

export const getBlockComments = async (id: number, options?: PaginationAttributes) => {
  "use server";
  const layer = getServiceLayer();
  return runEffect(
    ArenaService.pipe(
      Effect.tap(() => Effect.logInfo(`getBlockComments:${id}:start`)),
      Effect.andThen((arena) =>
        arena.client.block(id).comments(options).pipe(Effect.retry(retryPolicy)),
      ),
      Effect.tap(() => Effect.logInfo(`getBlockComments:${id}:success`)),
    ),
    layer,
  );
};

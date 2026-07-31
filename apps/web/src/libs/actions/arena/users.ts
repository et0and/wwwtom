import { Effect } from "effect";
import { ArenaService } from "@tom/arena/service";
import type { PaginationAttributes } from "@tom/arena";
import { retryPolicy } from "@tom/utils";
import { runEffect, getServiceLayer } from "~/libs/runtime";

export const getUser = async (id: number | string) => {
  "use server";
  const layer = getServiceLayer();
  return runEffect(
    ArenaService.pipe(
      Effect.tap(() => Effect.logInfo(`getUser:${id}:start`)),
      Effect.andThen((arena) =>
        arena.client.user(id).get().pipe(Effect.retry(retryPolicy)),
      ),
      Effect.tap(() => Effect.logInfo(`getUser:${id}:success`)),
    ),
    layer,
  );
};

export const getUserChannels = async (id: number | string, options?: PaginationAttributes) => {
  "use server";
  const layer = getServiceLayer();
  return runEffect(
    ArenaService.pipe(
      Effect.tap(() => Effect.logInfo(`getUserChannels:${id}:start`)),
      Effect.andThen((arena) =>
        arena.client.user(id).channels(options).pipe(Effect.retry(retryPolicy)),
      ),
      Effect.tap(() => Effect.logInfo(`getUserChannels:${id}:success`)),
    ),
    layer,
  );
};

export const getUserFollowing = async (id: number | string) => {
  "use server";
  const layer = getServiceLayer();
  return runEffect(
    ArenaService.pipe(
      Effect.tap(() => Effect.logInfo(`getUserFollowing:${id}:start`)),
      Effect.andThen((arena) =>
        arena.client.user(id).following().pipe(Effect.retry(retryPolicy)),
      ),
      Effect.tap(() => Effect.logInfo(`getUserFollowing:${id}:success`)),
    ),
    layer,
  );
};

export const getUserFollowers = async (id: number | string) => {
  "use server";
  const layer = getServiceLayer();
  return runEffect(
    ArenaService.pipe(
      Effect.tap(() => Effect.logInfo(`getUserFollowers:${id}:start`)),
      Effect.andThen((arena) =>
        arena.client.user(id).followers().pipe(Effect.retry(retryPolicy)),
      ),
      Effect.tap(() => Effect.logInfo(`getUserFollowers:${id}:success`)),
    ),
    layer,
  );
};

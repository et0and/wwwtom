import { Effect, Layer } from "effect";
import {
  BackingPersistence,
  PersistenceError,
  type BackingPersistenceStore,
} from "effect/unstable/persistence/Persistence";
import type { AgentChatStorage } from "./storage";

const wrapErr = (operation: string, key?: string) => (cause: unknown) =>
  new PersistenceError({
    message: `Failed to ${operation}${key === undefined ? "" : ` key ${key}`} in agent chat storage`,
    cause,
  });

/**
 * `BackingPersistence` over the hosting Durable Object's storage, so a chat
 * transcript survives eviction, deploys, and crashes. Keys are namespaced with
 * `${storeId}:`, mirroring Alchemy's `DurableObjectChatPersistence` (which
 * needs the Effect-native DO runtime this Elysia worker does not use).
 */
export const durableObjectPersistenceLayer = (
  storage: AgentChatStorage,
): Layer.Layer<BackingPersistence> =>
  Layer.succeed(
    BackingPersistence,
    BackingPersistence.of({
      make: (storeId) =>
        Effect.sync(() => {
          const prefixed = (key: string) => `${storeId}:${key}`;
          return {
            get: (key) =>
              Effect.tryPromise({
                try: () => storage.get(prefixed(key)),
                catch: wrapErr("get", key),
              }),
            getMany: (keys) =>
              Effect.tryPromise({
                try: () => storage.get(keys.map(prefixed)),
                catch: wrapErr("getMany"),
              }).pipe(
                Effect.map(
                  (entries) =>
                    keys.map((key) => entries.get(prefixed(key))) as [
                      object | undefined,
                      ...(object | undefined)[],
                    ],
                ),
              ),
            set: (key, value, _ttl) =>
              Effect.tryPromise({
                try: () => storage.put({ [prefixed(key)]: value }),
                catch: wrapErr("set", key),
              }),
            setMany: (entries) =>
              Effect.tryPromise({
                try: () =>
                  storage.put(
                    Object.fromEntries(entries.map(([key, value, _ttl]) => [prefixed(key), value])),
                  ),
                catch: wrapErr("setMany"),
              }),
            remove: (key) =>
              Effect.tryPromise({
                try: () => storage.delete([prefixed(key)]),
                catch: wrapErr("remove", key),
              }).pipe(Effect.asVoid),
            clear: Effect.tryPromise({
              try: () => storage.list({ prefix: `${storeId}:` }),
              catch: wrapErr("clear"),
            }).pipe(
              Effect.flatMap((keys) =>
                keys.size === 0
                  ? Effect.void
                  : Effect.tryPromise({
                      try: () => storage.delete([...keys.keys()]),
                      catch: wrapErr("clear"),
                    }).pipe(Effect.asVoid),
              ),
            ),
          } satisfies BackingPersistenceStore;
        }),
    }),
  );

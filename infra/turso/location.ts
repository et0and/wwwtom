import * as Effect from "effect/Effect";
import { deepEqual, isResolved } from "alchemy/Diff";
import * as Provider from "alchemy/Provider";
import { Resource } from "alchemy/Resource";
import type { ResourceClassLike } from "alchemy/Resource";
import { InvalidArgument } from "./errors.ts";
import { TursoHttp } from "./http.ts";

export type LocationProps = {
  /** Location code as listed by `GET /v1/locations`, e.g. `aws-eu-west-1`. */
  readonly code: string;
};

export type LocationAttributes = {
  readonly code: string;
  /** Human-readable location name, e.g. `AWS EU West (Ireland)`. */
  readonly name: string;
};

export interface Location extends Resource<"Turso.Location", LocationProps, LocationAttributes> {}

export const Location = Resource<Location>("Turso.Location");

export const LocationProvider = () =>
  Provider.effect(
    Location as ResourceClassLike<Location>,
    Effect.gen(function* () {
      const http = yield* TursoHttp;

      const findByCode = (code: string) =>
        Effect.gen(function* () {
          const { locations } = yield* http.listLocations();
          const name = locations[code];
          return name === undefined ? undefined : { code, name };
        });

      return {
        list: () => Effect.succeed([] as LocationAttributes[]),

        // The code is the physical identity, so changing it replaces the entry.
        diff: ({ olds, news }) =>
          Effect.sync(() => {
            if (!isResolved(news)) return undefined;
            if (!deepEqual(olds?.code, news.code)) return { action: "replace" } as const;
            return undefined;
          }),

        read: Effect.fn(function* ({ olds }) {
          const code = olds?.code;
          if (code === undefined) return undefined;
          return yield* findByCode(code);
        }),

        reconcile: Effect.fn(function* ({ news }) {
          const found = yield* findByCode(news.code);
          if (!found) {
            return yield* new InvalidArgument({
              message: `Turso location ${news.code} is not listed by GET /v1/locations`,
            });
          }
          return found;
        }),

        delete: Effect.fn(function* () {
          // Location is a catalog entry owned by Turso; nothing to delete.
        }),

        // Catalog entries cannot be removed, so nuke must not report them as
        // undeletable.
        nuke: { skip: true },
      } satisfies Provider.ProviderServiceInput<Location>;
    }),
  );

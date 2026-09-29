import * as Effect from "effect/Effect";
import { deepEqual, isResolved } from "alchemy/Diff";
import * as Provider from "alchemy/Provider";
import { Resource } from "alchemy/Resource";
import type { ResourceClassLike } from "alchemy/Resource";
import { InvalidArgument } from "./errors.ts";
import { TursoHttp } from "./http.ts";
import type { Group as GroupSchema, GroupConfiguration, GroupExtensions } from "./schemas.ts";

export type GroupProps = {
  /** Group name, unique across the organization. Turso has no rename endpoint,
   * so changing this after creation is refused rather than silently ignored. */
  readonly name: string;
  /** Primary location key. Required to create a group, and immutable afterwards.
   * Creating more than one group needs a Scaler, Pro or Enterprise plan. */
  readonly location?: string;
  /** Extensions for databases created in this group. Create-only, like `location`. */
  readonly extensions?: GroupExtensions;
  /** The only group setting the Platform API can change after creation. */
  readonly deleteProtection?: boolean;
};

export type GroupAttributes = {
  readonly name: string;
  readonly uuid: string;
  readonly primary: string;
  readonly deleteProtection: boolean;
};

export interface Group extends Resource<"Turso.Group", GroupProps, GroupAttributes> {}

export const Group = Resource<Group>("Turso.Group");

/**
 * `primary` is the current field; `locations` is deprecated upstream but is the
 * only one some responses still carry, so it is the fallback.
 */
const primaryOf = (group: GroupSchema): string => group.primary ?? group.locations?.[0] ?? "";

const toAttrs = (group: GroupSchema, configuration: GroupConfiguration): GroupAttributes => ({
  name: group.name,
  uuid: group.uuid,
  primary: primaryOf(group),
  deleteProtection: configuration.delete_protection,
});

export const GroupProvider = () =>
  Provider.effect(
    Group as ResourceClassLike<Group>,
    Effect.gen(function* () {
      const http = yield* TursoHttp;

      const findByName = (name: string) =>
        Effect.gen(function* () {
          const { groups } = yield* http.listGroups();
          const found = groups.find((group) => group.name === name);
          if (!found) return undefined;
          return {
            group: found,
            configuration: yield* http.getGroupConfiguration(name),
          };
        });

      return {
        // Empty on purpose: Turso's list is unfiltered per organization, so
        // enumerating it would let `alchemy nuke` delete the shared `default`
        // group and every production database in it.
        list: () => Effect.succeed([] as GroupAttributes[]),

        diff: ({ olds, news }) =>
          Effect.sync(() => {
            if (!isResolved(news)) return undefined;
            const old = olds ?? {};
            const hasImmutableDrift =
              (old.name !== undefined && old.name !== news.name) ||
              !deepEqual(old.location, news.location) ||
              !deepEqual(old.extensions, news.extensions);
            const hasProtectionDrift =
              (old.deleteProtection ?? false) !== (news.deleteProtection ?? false);
            if (hasImmutableDrift || hasProtectionDrift) return { action: "update" } as const;
            return undefined;
          }),

        read: Effect.fn(function* ({ olds }) {
          const name = olds?.name;
          if (name === undefined) return undefined;
          const observed = yield* findByName(name);
          if (!observed) return undefined;
          return toAttrs(observed.group, observed.configuration);
        }),

        reconcile: Effect.fn(function* ({ news }) {
          const observed = yield* findByName(news.name);
          if (!observed) {
            if (news.location === undefined) {
              return yield* new InvalidArgument({
                message: `Turso group ${news.name} does not exist, so location must be set to create it`,
              });
            }
            const created = yield* http.createGroup({
              name: news.name,
              location: news.location,
              ...(news.extensions !== undefined ? { extensions: news.extensions } : undefined),
            });
            return toAttrs(created.group, yield* http.getGroupConfiguration(news.name));
          }

          // Location and extensions have no update endpoint, and replacing the
          // group would delete every database in it. Refuse instead. `location`
          // is only a create input, so an adopted group is left alone when the
          // stack does not declare one.
          if (news.location !== undefined && primaryOf(observed.group) !== news.location) {
            return yield* new InvalidArgument({
              message: `Turso group ${news.name} is in ${primaryOf(observed.group) || "an unknown location"} but the stack declares ${news.location}; a group cannot be moved, so change the logical id or delete the group by hand`,
            });
          }

          const deleteProtection = news.deleteProtection ?? false;
          if (observed.configuration.delete_protection === deleteProtection) {
            return toAttrs(observed.group, observed.configuration);
          }

          yield* http.updateGroupConfiguration(news.name, { delete_protection: deleteProtection });
          // The configuration PATCH answers with the configuration only, so the
          // full group is re-read to keep attributes complete.
          const updated = yield* http.getGroup(news.name);
          return toAttrs(updated.group, yield* http.getGroupConfiguration(news.name));
        }),

        delete: Effect.fn(function* ({ output }) {
          yield* http.deleteGroup(output.name).pipe(Effect.catchTag("NotFound", () => Effect.void));
        }),
      } satisfies Provider.ProviderServiceInput<Group>;
    }),
  );

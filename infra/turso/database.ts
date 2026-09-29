import * as Effect from "effect/Effect";
import { deepEqual, isResolved } from "alchemy/Diff";
import * as Provider from "alchemy/Provider";
import { Resource } from "alchemy/Resource";
import type { ResourceClassLike } from "alchemy/Resource";
import { InvalidArgument } from "./errors.ts";
import { TursoHttp } from "./http.ts";
import type { Database as DatabaseSchema, DatabaseConfiguration } from "./schemas.ts";

export type DatabaseProps = {
  /** Database name: lowercase letters, numbers and dashes, at most 64
   * characters. Turso has no rename endpoint, so changing it is refused. */
  readonly name: string;
  /** Name of the group the database lives in. The group must already exist. */
  readonly group: string;
  /** Maximum size in bytes, or a value with a unit such as `1mb` or `1gb`. */
  readonly sizeLimit?: string;
  readonly deleteProtection?: boolean;
  readonly blockReads?: boolean;
  readonly blockWrites?: boolean;
  /** IP addresses and CIDR blocks allowed to connect. An empty list clears it. */
  readonly allowedIps?: readonly string[];
  /** AWS VPC endpoint IDs allowed to connect. An empty list clears it. */
  readonly allowedAwsVpcIds?: readonly string[];
};

export type DatabaseAttributes = {
  readonly name: string;
  readonly dbId: string;
  /** DNS hostname for libSQL and HTTP connections. */
  readonly hostname: string;
  readonly group: string;
  readonly primaryRegion: string;
  readonly sizeLimit?: string;
  readonly deleteProtection: boolean;
  readonly blockReads: boolean;
  readonly blockWrites: boolean;
  readonly allowedIps: readonly string[];
  readonly parentName?: string;
};

export interface Database extends Resource<"Turso.Database", DatabaseProps, DatabaseAttributes> {}

export const Database = Resource<Database>("Turso.Database");

const toAttrs = (
  database: DatabaseSchema,
  configuration: DatabaseConfiguration,
): DatabaseAttributes => ({
  name: database.Name,
  dbId: database.DbId,
  hostname: database.Hostname,
  group: database.group,
  primaryRegion: database.primaryRegion,
  ...(configuration.size_limit !== undefined ? { sizeLimit: configuration.size_limit } : undefined),
  deleteProtection: configuration.delete_protection ?? false,
  blockReads: configuration.block_reads ?? false,
  blockWrites: configuration.block_writes ?? false,
  allowedIps: configuration.allowed_ips ?? [],
  ...(database.parent ? { parentName: database.parent.name } : undefined),
});

/**
 * The body `PATCH /databases/{name}/configuration` accepts, from declared props.
 * Accepts partial props so it also builds the comparable old-side body.
 */
const configurationOf = (props: Partial<DatabaseProps>) => ({
  ...(props.sizeLimit !== undefined ? { size_limit: props.sizeLimit } : undefined),
  ...(props.deleteProtection !== undefined
    ? { delete_protection: props.deleteProtection }
    : undefined),
  ...(props.blockReads !== undefined ? { block_reads: props.blockReads } : undefined),
  ...(props.blockWrites !== undefined ? { block_writes: props.blockWrites } : undefined),
  ...(props.allowedIps !== undefined ? { allowed_ips: [...props.allowedIps] } : undefined),
  ...(props.allowedAwsVpcIds !== undefined
    ? { allowed_aws_vpc_ids: [...props.allowedAwsVpcIds] }
    : undefined),
});

/**
 * The PATCH is only sent when `GET /databases/{name}/configuration` disagrees
 * with the declared props. Turso reports the applied value of every setting, so
 * a converged database costs one extra read and no write. Each declared field is
 * compared on its own: Turso always reports every field, so comparing whole
 * bodies would read the undeclared settings as drift.
 */
const differsFrom = (
  configuration: DatabaseConfiguration,
  props: Partial<DatabaseProps>,
): boolean => {
  const desired = configurationOf(props);
  return (
    (desired.size_limit !== undefined && desired.size_limit !== configuration.size_limit) ||
    (desired.delete_protection !== undefined &&
      desired.delete_protection !== configuration.delete_protection) ||
    (desired.block_reads !== undefined && desired.block_reads !== configuration.block_reads) ||
    (desired.block_writes !== undefined && desired.block_writes !== configuration.block_writes) ||
    (desired.allowed_ips !== undefined &&
      !deepEqual(desired.allowed_ips, configuration.allowed_ips ?? [])) ||
    (desired.allowed_aws_vpc_ids !== undefined &&
      !deepEqual(desired.allowed_aws_vpc_ids, configuration.allowed_aws_vpc_ids ?? []))
  );
};

export const DatabaseProvider = () =>
  Provider.effect(
    Database as ResourceClassLike<Database>,
    Effect.gen(function* () {
      const http = yield* TursoHttp;

      const findByName = (name: string) =>
        Effect.gen(function* () {
          const { databases } = yield* http.listDatabases({});
          const found = databases.find((database) => database.Name === name);
          if (!found) return undefined;
          return {
            database: found,
            configuration: yield* http.getDatabaseConfiguration(name),
          };
        });

      return {
        // Empty on purpose: Turso's list is unfiltered per organization, so
        // enumerating it would let `alchemy nuke` delete production databases.
        list: () => Effect.succeed([] as DatabaseAttributes[]),

        // Name and group are the physical identity: Turso can neither rename a
        // database nor move it to another group. Everything else is an in-place
        // configuration update.
        diff: ({ olds, news }) =>
          Effect.sync(() => {
            if (!isResolved(news)) return undefined;
            const old = olds ?? {};
            if (
              (old.name !== undefined && old.name !== news.name) ||
              (old.group !== undefined && old.group !== news.group)
            ) {
              return { action: "replace" } as const;
            }
            if (!deepEqual(configurationOf(news), configurationOf(old), { stripNullish: true })) {
              return { action: "update" } as const;
            }
            return undefined;
          }),

        read: Effect.fn(function* ({ olds }) {
          const name = olds?.name;
          if (name === undefined) return undefined;
          const observed = yield* findByName(name);
          if (!observed) return undefined;
          return toAttrs(observed.database, observed.configuration);
        }),

        reconcile: Effect.fn(function* ({ news }) {
          const observed = yield* findByName(news.name);
          const desired = configurationOf(news);

          if (!observed) {
            const created = yield* http.createDatabase({
              name: news.name,
              group: news.group,
              ...(news.sizeLimit !== undefined ? { size_limit: news.sizeLimit } : undefined),
            });
            if (Object.keys(desired).length === 0) return toAttrs(created.database, {});
            yield* http.updateDatabaseConfiguration(news.name, desired);
            const configured = yield* http.getDatabase(news.name);
            return toAttrs(configured.database, yield* http.getDatabaseConfiguration(news.name));
          }

          if (observed.database.group !== news.group) {
            // Re-creating would drop the data, so this is refused, not applied.
            return yield* new InvalidArgument({
              message: `Turso database ${news.name} is in group ${observed.database.group} but the stack declares ${news.group}; a database cannot change group, so change the logical id or delete the database by hand`,
            });
          }

          if (!differsFrom(observed.configuration, news)) {
            return toAttrs(observed.database, observed.configuration);
          }

          yield* http.updateDatabaseConfiguration(news.name, desired);
          // The configuration PATCH answers with the configuration only, so the
          // full database is re-read to keep attributes complete.
          const updated = yield* http.getDatabase(news.name);
          return toAttrs(updated.database, yield* http.getDatabaseConfiguration(news.name));
        }),

        delete: Effect.fn(function* ({ output }) {
          yield* http
            .deleteDatabase(output.name)
            .pipe(Effect.catchTag("NotFound", () => Effect.void));
        }),
      } satisfies Provider.ProviderServiceInput<Database>;
    }),
  );

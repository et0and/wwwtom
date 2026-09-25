import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Conflict, NotFound } from "./errors.ts";
import { TursoHttp } from "./http.ts";
import type { CreateDatabaseTokenOptions, ListDatabasesFilter, TursoHttpApi } from "./http.ts";
import type {
  Database,
  DatabaseConfiguration,
  Group,
  GroupConfiguration,
  NewGroup,
} from "./schemas.ts";

export type TursoCall = {
  readonly method: "GET" | "POST" | "PATCH" | "DELETE";
  readonly path: string;
};

/**
 * Turso stores the mutable settings on the resource itself and serves them from
 * a separate `/configuration` endpoint, so the fake keeps them on one record and
 * projects the two views the API exposes.
 */
export type StoredGroup = Group & GroupConfiguration;
export type StoredDatabase = Database & DatabaseConfiguration;

export type FakeState = {
  /** Organization slug, used to build database hostnames. */
  readonly organization: string;
  readonly locations: Record<string, string>;
  readonly groups: Map<string, StoredGroup>;
  readonly databases: Map<string, StoredDatabase>;
  readonly mintedTokens: string[];
  readonly calls: TursoCall[];
};

export const makeFakeState = (): FakeState => ({
  organization: "wwwtom",
  locations: {
    "aws-eu-west-1": "AWS EU West (Ireland)",
    "aws-us-east-1": "AWS US East (Virginia)",
  },
  groups: new Map(),
  databases: new Map(),
  mintedTokens: [],
  calls: [],
});

const record = (state: FakeState, method: TursoCall["method"], path: string): void => {
  state.calls.push({ method, path });
};

/** The `GET`/`PATCH .../configuration` view of a stored database. */
const configurationOf = (database: StoredDatabase): DatabaseConfiguration => ({
  size_limit: database.size_limit,
  block_reads: database.block_reads,
  block_writes: database.block_writes,
  delete_protection: database.delete_protection,
  allowed_ips: database.allowed_ips,
  allowed_aws_vpc_ids: database.allowed_aws_vpc_ids,
});

let sequence = 0;
const nextId = (prefix: string): string => `${prefix}-${++sequence}`;

export const makeFakeTursoHttpLayer = (state: FakeState): Layer.Layer<TursoHttp> =>
  Layer.succeed(TursoHttp, {
    listLocations: () =>
      Effect.sync(() => {
        record(state, "GET", "/v1/locations");
        return { locations: { ...state.locations } };
      }),

    listGroups: () =>
      Effect.sync(() => {
        record(state, "GET", "/groups");
        return { groups: [...state.groups.values()] };
      }),

    getGroup: (name) =>
      Effect.gen(function* () {
        record(state, "GET", `/groups/${name}`);
        const group = state.groups.get(name);
        if (!group) return yield* new NotFound({ message: `group not found: ${name}` });
        return { group };
      }),

    createGroup: (body: NewGroup) =>
      Effect.gen(function* () {
        record(state, "POST", "/groups");
        if (state.groups.has(body.name)) {
          return yield* new Conflict({ message: `group already exists: ${body.name}` });
        }
        const group: StoredGroup = {
          name: body.name,
          uuid: nextId("group"),
          primary: body.location,
          delete_protection: false,
          locations: [body.location],
        };
        state.groups.set(body.name, group);
        return { group };
      }),

    getGroupConfiguration: (name) =>
      Effect.gen(function* () {
        record(state, "GET", `/groups/${name}/configuration`);
        const group = state.groups.get(name);
        if (!group) return yield* new NotFound({ message: `group not found: ${name}` });
        return { delete_protection: group.delete_protection };
      }),

    updateGroupConfiguration: (name, body) =>
      Effect.gen(function* () {
        record(state, "PATCH", `/groups/${name}/configuration`);
        const group = state.groups.get(name);
        if (!group) return yield* new NotFound({ message: `group not found: ${name}` });
        const updated: StoredGroup = { ...group, delete_protection: body.delete_protection };
        state.groups.set(name, updated);
        return { delete_protection: updated.delete_protection };
      }),

    deleteGroup: (name) =>
      Effect.gen(function* () {
        record(state, "DELETE", `/groups/${name}`);
        if (!state.groups.has(name)) {
          return yield* new NotFound({ message: `group not found: ${name}` });
        }
        state.groups.delete(name);
      }),

    listDatabases: (filter: ListDatabasesFilter) =>
      Effect.sync(() => {
        record(state, "GET", "/databases");
        const databases = [...state.databases.values()].filter(
          (database) => filter.group === undefined || database.group === filter.group,
        );
        return { databases };
      }),

    getDatabase: (name) =>
      Effect.gen(function* () {
        record(state, "GET", `/databases/${name}`);
        const database = state.databases.get(name);
        if (!database) {
          return yield* new NotFound({ message: `could not find database with name ${name}` });
        }
        return { database };
      }),

    createDatabase: (body) =>
      Effect.gen(function* () {
        record(state, "POST", "/databases");
        if (state.databases.has(body.name)) {
          return yield* new Conflict({ message: `database with name ${body.name} already exists` });
        }
        if (!state.groups.has(body.group)) {
          return yield* new NotFound({ message: `group not found: ${body.group}` });
        }
        const database: StoredDatabase = {
          Name: body.name,
          DbId: nextId("db"),
          Hostname: `${body.name}-${state.organization}.turso.io`,
          group: body.group,
          primaryRegion: state.groups.get(body.group)?.primary ?? "",
          block_reads: false,
          block_writes: false,
          delete_protection: false,
          ...(body.size_limit !== undefined ? { size_limit: body.size_limit } : undefined),
        };
        state.databases.set(body.name, database);
        return { database };
      }),

    getDatabaseConfiguration: (name) =>
      Effect.gen(function* () {
        record(state, "GET", `/databases/${name}/configuration`);
        const database = state.databases.get(name);
        if (!database) {
          return yield* new NotFound({ message: `could not find database with name ${name}` });
        }
        return configurationOf(database);
      }),

    updateDatabaseConfiguration: (name, body) =>
      Effect.gen(function* () {
        record(state, "PATCH", `/databases/${name}/configuration`);
        const database = state.databases.get(name);
        if (!database) {
          return yield* new NotFound({ message: `could not find database with name ${name}` });
        }
        const updated: StoredDatabase = {
          ...database,
          ...(body.size_limit !== undefined ? { size_limit: body.size_limit } : undefined),
          ...(body.block_reads !== undefined ? { block_reads: body.block_reads } : undefined),
          ...(body.block_writes !== undefined ? { block_writes: body.block_writes } : undefined),
          ...(body.delete_protection !== undefined
            ? { delete_protection: body.delete_protection }
            : undefined),
          ...(body.allowed_ips !== undefined ? { allowed_ips: body.allowed_ips } : undefined),
          ...(body.allowed_aws_vpc_ids !== undefined
            ? { allowed_aws_vpc_ids: body.allowed_aws_vpc_ids }
            : undefined),
        };
        state.databases.set(name, updated);
        // The real PATCH answers with the configuration it applied.
        return configurationOf(updated);
      }),

    deleteDatabase: (name) =>
      Effect.gen(function* () {
        record(state, "DELETE", `/databases/${name}`);
        if (!state.databases.has(name)) {
          return yield* new NotFound({ message: `could not find database with name ${name}` });
        }
        state.databases.delete(name);
      }),

    createDatabaseToken: (name, options: CreateDatabaseTokenOptions) =>
      Effect.gen(function* () {
        record(state, "POST", `/databases/${name}/auth/tokens`);
        if (!state.databases.has(name)) {
          return yield* new NotFound({ message: `could not find database with name ${name}` });
        }
        const jwt = `jwt.${name}.${state.mintedTokens.length + 1}.${options.authorization ?? "full-access"}`;
        state.mintedTokens.push(jwt);
        return { jwt };
      }),
  } satisfies TursoHttpApi);

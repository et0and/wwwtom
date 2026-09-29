import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { TursoCredentials } from "./credentials.ts";
import { HttpError, mapStatusToError } from "./errors.ts";
import type { HttpMethodError } from "./errors.ts";
import type {
  CreateDatabase,
  CreateDatabaseTokenResponse,
  DatabaseConfiguration,
  GetDatabaseResponse,
  GetGroupResponse,
  GroupConfiguration,
  ListDatabasesResponse,
  ListGroupsResponse,
  ListLocationsResponse,
  NewGroup,
} from "./schemas.ts";
import {
  CreateDatabaseTokenResponseSchema,
  DatabaseConfigurationSchema,
  GetDatabaseResponseSchema,
  GetGroupResponseSchema,
  GroupConfigurationSchema,
  ListDatabasesResponseSchema,
  ListGroupsResponseSchema,
  ListLocationsResponseSchema,
} from "./schemas.ts";

export type TokenAuthorization = "full-access" | "read-only";

export type ListDatabasesFilter = {
  readonly group?: string;
};

export type CreateDatabaseTokenOptions = {
  readonly expiration?: string;
  readonly authorization?: TokenAuthorization;
};

export type TursoHttpApi = {
  readonly listLocations: () => Effect.Effect<ListLocationsResponse, HttpMethodError>;

  readonly listGroups: () => Effect.Effect<ListGroupsResponse, HttpMethodError>;
  readonly getGroup: (name: string) => Effect.Effect<GetGroupResponse, HttpMethodError>;
  readonly createGroup: (body: NewGroup) => Effect.Effect<GetGroupResponse, HttpMethodError>;
  readonly getGroupConfiguration: (
    name: string,
  ) => Effect.Effect<GroupConfiguration, HttpMethodError>;
  readonly updateGroupConfiguration: (
    name: string,
    body: GroupConfiguration,
  ) => Effect.Effect<GroupConfiguration, HttpMethodError>;
  readonly deleteGroup: (name: string) => Effect.Effect<void, HttpMethodError>;

  readonly listDatabases: (
    filter: ListDatabasesFilter,
  ) => Effect.Effect<ListDatabasesResponse, HttpMethodError>;
  readonly getDatabase: (name: string) => Effect.Effect<GetDatabaseResponse, HttpMethodError>;
  readonly createDatabase: (
    body: CreateDatabase,
  ) => Effect.Effect<GetDatabaseResponse, HttpMethodError>;
  readonly getDatabaseConfiguration: (
    name: string,
  ) => Effect.Effect<DatabaseConfiguration, HttpMethodError>;
  readonly updateDatabaseConfiguration: (
    name: string,
    body: DatabaseConfiguration,
  ) => Effect.Effect<DatabaseConfiguration, HttpMethodError>;
  readonly deleteDatabase: (name: string) => Effect.Effect<void, HttpMethodError>;

  /** Mints a SQL-engine JWT. This is a data-plane credential, unrelated to the
   * control-plane platform token used for every other call here. */
  readonly createDatabaseToken: (
    name: string,
    options: CreateDatabaseTokenOptions,
  ) => Effect.Effect<CreateDatabaseTokenResponse, HttpMethodError>;
};

export class TursoHttp extends Context.Service<TursoHttp, TursoHttpApi>()("TursoHttp") {}

const TURSO_BASE = "https://api.turso.tech";

const tursoFetch = (
  url: string,
  init: RequestInit,
  token: Redacted.Redacted,
): Effect.Effect<Response, HttpError> =>
  Effect.tryPromise({
    try: () => {
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${Redacted.value(token)}`);
      headers.set("Content-Type", "application/json");
      return fetch(url, { ...init, headers: Object.fromEntries(headers.entries()) });
    },
    catch: (cause) =>
      new HttpError({
        message: cause instanceof Error ? cause.message : String(cause),
        status: 0,
        body: String(cause),
      }),
  });

/**
 * `TursoHttp` is typed against plain `Codec`s with no services: the schemas in
 * `schemas.ts` are transcribed from the pinned OpenAPI document and are pure
 * JSON, so every response is validated here at the one boundary that crosses the
 * network. Excess fields are dropped, so the API can add properties without
 * breaking a deploy.
 */
const jsonFetch = <A>(
  schema: Schema.Codec<A, unknown, never, never>,
  url: string,
  init: RequestInit,
  token: Redacted.Redacted,
): Effect.Effect<A, HttpMethodError> =>
  Effect.gen(function* () {
    const res = yield* tursoFetch(url, init, token);
    const text = yield* Effect.promise(() => res.text());
    if (!res.ok) {
      return yield* mapStatusToError(res.status, text);
    }
    const json = yield* Effect.try({
      try: () => Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown))(text),
      catch: () =>
        new HttpError({ message: "invalid JSON response", status: res.status, body: text }),
    });
    return yield* Effect.try({
      try: () => Schema.decodeUnknownSync(schema)(json),
      catch: () =>
        new HttpError({ message: "invalid Turso response", status: res.status, body: text }),
    });
  });

const voidFetch = (
  url: string,
  init: RequestInit,
  token: Redacted.Redacted,
): Effect.Effect<void, HttpMethodError> =>
  Effect.gen(function* () {
    const res = yield* tursoFetch(url, init, token);
    if (!res.ok) {
      const text = yield* Effect.promise(() => res.text());
      return yield* mapStatusToError(res.status, text);
    }
  });

export const TursoHttpLive = Layer.effect(
  TursoHttp,
  Effect.gen(function* () {
    const creds = yield* TursoCredentials;
    const org = encodeURIComponent(creds.organization);
    const orgPath = `/v1/organizations/${org}`;

    const json = <A>(
      schema: Schema.Codec<A, unknown, never, never>,
      path: string,
      init: RequestInit,
    ): Effect.Effect<A, HttpMethodError> =>
      jsonFetch(schema, `${TURSO_BASE}${path}`, init, creds.token);

    const voidCall = (path: string, init: RequestInit): Effect.Effect<void, HttpMethodError> =>
      voidFetch(`${TURSO_BASE}${path}`, init, creds.token);

    const patch = <A>(
      schema: Schema.Codec<A, unknown, never, never>,
      path: string,
      body: GroupConfiguration | DatabaseConfiguration,
    ): Effect.Effect<A, HttpMethodError> =>
      json(schema, path, { method: "PATCH", body: JSON.stringify(body) });

    return {
      listLocations: () => json(ListLocationsResponseSchema, "/v1/locations", { method: "GET" }),

      listGroups: () => json(ListGroupsResponseSchema, `${orgPath}/groups`, { method: "GET" }),
      getGroup: (name) =>
        json(GetGroupResponseSchema, `${orgPath}/groups/${encodeURIComponent(name)}`, {
          method: "GET",
        }),
      createGroup: (body) =>
        json(GetGroupResponseSchema, `${orgPath}/groups`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      getGroupConfiguration: (name) =>
        json(
          GroupConfigurationSchema,
          `${orgPath}/groups/${encodeURIComponent(name)}/configuration`,
          { method: "GET" },
        ),
      updateGroupConfiguration: (name, body) =>
        patch(
          GroupConfigurationSchema,
          `${orgPath}/groups/${encodeURIComponent(name)}/configuration`,
          body,
        ),
      deleteGroup: (name) =>
        voidCall(`${orgPath}/groups/${encodeURIComponent(name)}`, { method: "DELETE" }),

      listDatabases: (filter) => {
        const search =
          filter.group === undefined ? "" : `?group=${encodeURIComponent(filter.group)}`;
        return json(ListDatabasesResponseSchema, `${orgPath}/databases${search}`, {
          method: "GET",
        });
      },
      getDatabase: (name) =>
        json(GetDatabaseResponseSchema, `${orgPath}/databases/${encodeURIComponent(name)}`, {
          method: "GET",
        }),
      createDatabase: (body) =>
        json(GetDatabaseResponseSchema, `${orgPath}/databases`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      getDatabaseConfiguration: (name) =>
        json(
          DatabaseConfigurationSchema,
          `${orgPath}/databases/${encodeURIComponent(name)}/configuration`,
          { method: "GET" },
        ),
      updateDatabaseConfiguration: (name, body) =>
        patch(
          DatabaseConfigurationSchema,
          `${orgPath}/databases/${encodeURIComponent(name)}/configuration`,
          body,
        ),
      deleteDatabase: (name) =>
        voidCall(`${orgPath}/databases/${encodeURIComponent(name)}`, { method: "DELETE" }),

      createDatabaseToken: (name, options) => {
        const query = new URLSearchParams({
          expiration: options.expiration ?? "never",
          authorization: options.authorization ?? "full-access",
        });
        return json(
          CreateDatabaseTokenResponseSchema,
          `${orgPath}/databases/${encodeURIComponent(name)}/auth/tokens?${query.toString()}`,
          { method: "POST" },
        );
      },
    } satisfies TursoHttpApi;
  }),
);

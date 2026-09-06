import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { CredentialsError, GtmCredentials } from "./credentials.ts";
import { HttpError, mapStatusToError } from "./errors.ts";
import type { HttpMethodError } from "./errors.ts";
import {
  AccountSchema,
  ContainerSchema,
  ContainerVersionHeaderSchema,
  ContainerVersionSchema,
  CreateContainerVersionResponseSchema,
  FolderSchema,
  GetWorkspaceStatusResponseSchema,
  ListContainersResponseSchema,
  ListFoldersResponseSchema,
  ListTagsResponseSchema,
  ListTriggersResponseSchema,
  ListVariablesResponseSchema,
  ListWorkspacesResponseSchema,
  PublishContainerVersionResponseSchema,
  TagSchema,
  TriggerSchema,
  VariableSchema,
  WorkspaceSchema,
} from "./schemas.ts";
import type {
  Account,
  Container,
  ContainerDraft,
  ContainerVersion,
  ContainerVersionHeader,
  CreateContainerVersionRequestVersionOptions,
  CreateContainerVersionResponse,
  Folder,
  FolderDraft,
  GetWorkspaceStatusResponse,
  ListContainersResponse,
  ListFoldersResponse,
  ListTagsResponse,
  ListTriggersResponse,
  ListVariablesResponse,
  ListWorkspacesResponse,
  PublishContainerVersionResponse,
  Tag,
  TagDraft,
  Trigger,
  TriggerDraft,
  Variable,
  VariableDraft,
  Workspace,
  WorkspaceDraft,
} from "./schemas.ts";

export type AccountApi = {
  readonly getAccount: (path: string) => Effect.Effect<Account, HttpMethodError | CredentialsError>;
};

export type ContainerApi = {
  readonly listContainers: (
    accountPath: string,
  ) => Effect.Effect<ListContainersResponse, HttpMethodError | CredentialsError>;
  readonly getContainer: (
    path: string,
  ) => Effect.Effect<Container, HttpMethodError | CredentialsError>;
  readonly createContainer: (
    accountPath: string,
    body: ContainerDraft,
  ) => Effect.Effect<Container, HttpMethodError | CredentialsError>;
  readonly updateContainer: (
    path: string,
    body: ContainerDraft,
  ) => Effect.Effect<Container, HttpMethodError | CredentialsError>;
  readonly deleteContainer: (
    path: string,
  ) => Effect.Effect<void, HttpMethodError | CredentialsError>;
};

export type WorkspaceApi = {
  readonly listWorkspaces: (
    containerPath: string,
  ) => Effect.Effect<ListWorkspacesResponse, HttpMethodError | CredentialsError>;
  readonly getWorkspace: (
    path: string,
  ) => Effect.Effect<Workspace, HttpMethodError | CredentialsError>;
  readonly createWorkspace: (
    containerPath: string,
    body: WorkspaceDraft,
  ) => Effect.Effect<Workspace, HttpMethodError | CredentialsError>;
  readonly updateWorkspace: (
    path: string,
    body: WorkspaceDraft,
  ) => Effect.Effect<Workspace, HttpMethodError | CredentialsError>;
  readonly deleteWorkspace: (
    path: string,
  ) => Effect.Effect<void, HttpMethodError | CredentialsError>;
};

export type TagApi = {
  readonly listTags: (
    workspacePath: string,
  ) => Effect.Effect<ListTagsResponse, HttpMethodError | CredentialsError>;
  readonly getTag: (path: string) => Effect.Effect<Tag, HttpMethodError | CredentialsError>;
  readonly createTag: (
    workspacePath: string,
    body: TagDraft,
  ) => Effect.Effect<Tag, HttpMethodError | CredentialsError>;
  readonly updateTag: (
    path: string,
    body: TagDraft,
  ) => Effect.Effect<Tag, HttpMethodError | CredentialsError>;
  readonly deleteTag: (path: string) => Effect.Effect<void, HttpMethodError | CredentialsError>;
};

export type TriggerApi = {
  readonly listTriggers: (
    workspacePath: string,
  ) => Effect.Effect<ListTriggersResponse, HttpMethodError | CredentialsError>;
  readonly getTrigger: (path: string) => Effect.Effect<Trigger, HttpMethodError | CredentialsError>;
  readonly createTrigger: (
    workspacePath: string,
    body: TriggerDraft,
  ) => Effect.Effect<Trigger, HttpMethodError | CredentialsError>;
  readonly updateTrigger: (
    path: string,
    body: TriggerDraft,
  ) => Effect.Effect<Trigger, HttpMethodError | CredentialsError>;
  readonly deleteTrigger: (path: string) => Effect.Effect<void, HttpMethodError | CredentialsError>;
};

export type VariableApi = {
  readonly listVariables: (
    workspacePath: string,
  ) => Effect.Effect<ListVariablesResponse, HttpMethodError | CredentialsError>;
  readonly getVariable: (
    path: string,
  ) => Effect.Effect<Variable, HttpMethodError | CredentialsError>;
  readonly createVariable: (
    workspacePath: string,
    body: VariableDraft,
  ) => Effect.Effect<Variable, HttpMethodError | CredentialsError>;
  readonly updateVariable: (
    path: string,
    body: VariableDraft,
  ) => Effect.Effect<Variable, HttpMethodError | CredentialsError>;
  readonly deleteVariable: (
    path: string,
  ) => Effect.Effect<void, HttpMethodError | CredentialsError>;
};

export type FolderApi = {
  readonly listFolders: (
    workspacePath: string,
  ) => Effect.Effect<ListFoldersResponse, HttpMethodError | CredentialsError>;
  readonly getFolder: (path: string) => Effect.Effect<Folder, HttpMethodError | CredentialsError>;
  readonly createFolder: (
    workspacePath: string,
    body: FolderDraft,
  ) => Effect.Effect<Folder, HttpMethodError | CredentialsError>;
  readonly updateFolder: (
    path: string,
    body: FolderDraft,
  ) => Effect.Effect<Folder, HttpMethodError | CredentialsError>;
  readonly deleteFolder: (path: string) => Effect.Effect<void, HttpMethodError | CredentialsError>;
};

export type VersionApi = {
  readonly getWorkspaceStatus: (
    workspacePath: string,
  ) => Effect.Effect<GetWorkspaceStatusResponse, HttpMethodError | CredentialsError>;
  readonly createContainerVersion: (
    workspacePath: string,
    body: CreateContainerVersionRequestVersionOptions,
  ) => Effect.Effect<CreateContainerVersionResponse, HttpMethodError | CredentialsError>;
  readonly getLiveContainerVersion: (
    containerPath: string,
  ) => Effect.Effect<ContainerVersion, HttpMethodError | CredentialsError>;
  readonly getLatestContainerVersionHeader: (
    containerPath: string,
  ) => Effect.Effect<ContainerVersionHeader, HttpMethodError | CredentialsError>;
  readonly publishContainerVersion: (
    path: string,
  ) => Effect.Effect<PublishContainerVersionResponse, HttpMethodError | CredentialsError>;
  readonly getContainerVersion: (
    path: string,
  ) => Effect.Effect<ContainerVersion, HttpMethodError | CredentialsError>;
};

export type GtmHttpApi = AccountApi &
  ContainerApi &
  WorkspaceApi &
  TagApi &
  TriggerApi &
  VariableApi &
  FolderApi &
  VersionApi;

export class GtmHttp extends Context.Service<GtmHttp, GtmHttpApi>()("GtmHttp") {}

const GTM_BASE = "https://tagmanager.googleapis.com/tagmanager/v2";

const gtmFetch = (
  path: string,
  init: RequestInit,
  token: Redacted.Redacted,
): Effect.Effect<Response, HttpError> =>
  Effect.tryPromise({
    try: () => {
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${Redacted.value(token)}`);
      headers.set("Content-Type", "application/json");
      return fetch(`${GTM_BASE}/${path.replace(/^\//, "")}`, {
        ...init,
        headers: Object.fromEntries(headers.entries()),
      });
    },
    catch: (cause) =>
      new HttpError({
        message: cause instanceof Error ? cause.message : String(cause),
        status: 0,
        body: String(cause),
      }),
  });

const jsonFetch = <A>(
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- _schema is Schema<A> erased to unknown for generic jsonFetch; call sites pass typed schemas
  _schema: unknown,
  path: string,
  init: RequestInit,
  token: Redacted.Redacted,
): Effect.Effect<A, HttpMethodError> =>
  Effect.gen(function* () {
    const res = yield* gtmFetch(path, init, token);
    const text = yield* Effect.promise(() => res.text());
    if (!res.ok) {
      return yield* mapStatusToError(res.status, text);
    }
    return yield* Effect.try({
      try: () => Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown))(text) as A,
      catch: () =>
        new HttpError({ message: "invalid JSON response", status: res.status, body: text }),
    });
  });

const voidFetch = (
  path: string,
  init: RequestInit,
  token: Redacted.Redacted,
): Effect.Effect<void, HttpMethodError> =>
  Effect.gen(function* () {
    const res = yield* gtmFetch(path, init, token);
    if (!res.ok) {
      const text = yield* Effect.promise(() => res.text());
      return yield* mapStatusToError(res.status, text);
    }
  });

export const GtmHttpLive = Layer.effect(
  GtmHttp,
  Effect.gen(function* () {
    const creds = yield* GtmCredentials;

    const authed = <A>(
      request: (token: Redacted.Redacted) => Effect.Effect<A, HttpMethodError>,
    ): Effect.Effect<A, HttpMethodError | CredentialsError> =>
      Effect.flatMap(creds.getAccessToken, request);

    const authedJson = <A>(
      // oxlint-disable-next-line anti-slop/no-unknown-parameters -- _schema is Schema<A> erased; call sites pass typed schemas
      _schema: unknown,
      path: string,
      init: RequestInit,
    ): Effect.Effect<A, HttpMethodError | CredentialsError> =>
      authed((token) => jsonFetch(_schema, path, init, token));

    const authedVoid = (
      path: string,
      init: RequestInit,
    ): Effect.Effect<void, HttpMethodError | CredentialsError> =>
      authed((token) => voidFetch(path, init, token));

    return {
      getAccount: (path) => authedJson(AccountSchema, path, { method: "GET" }),
      listContainers: (accountPath) =>
        authedJson(ListContainersResponseSchema, `${accountPath}/containers`, { method: "GET" }),
      getContainer: (path) => authedJson(ContainerSchema, path, { method: "GET" }),
      createContainer: (accountPath, body) =>
        authedJson(ContainerSchema, `${accountPath}/containers`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      updateContainer: (path, body) =>
        authedJson(ContainerSchema, path, { method: "PUT", body: JSON.stringify(body) }),
      deleteContainer: (path) => authedVoid(path, { method: "DELETE" }),

      listWorkspaces: (containerPath) =>
        authedJson(ListWorkspacesResponseSchema, `${containerPath}/workspaces`, { method: "GET" }),
      getWorkspace: (path) => authedJson(WorkspaceSchema, path, { method: "GET" }),
      createWorkspace: (containerPath, body) =>
        authedJson(WorkspaceSchema, `${containerPath}/workspaces`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      updateWorkspace: (path, body) =>
        authedJson(WorkspaceSchema, path, { method: "PUT", body: JSON.stringify(body) }),
      deleteWorkspace: (path) => authedVoid(path, { method: "DELETE" }),

      listTags: (workspacePath) =>
        authedJson(ListTagsResponseSchema, `${workspacePath}/tags`, { method: "GET" }),
      getTag: (path) => authedJson(TagSchema, path, { method: "GET" }),
      createTag: (workspacePath, body) =>
        authedJson(TagSchema, `${workspacePath}/tags`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      updateTag: (path, body) =>
        authedJson(TagSchema, path, { method: "PUT", body: JSON.stringify(body) }),
      deleteTag: (path) => authedVoid(path, { method: "DELETE" }),

      listTriggers: (workspacePath) =>
        authedJson(ListTriggersResponseSchema, `${workspacePath}/triggers`, { method: "GET" }),
      getTrigger: (path) => authedJson(TriggerSchema, path, { method: "GET" }),
      createTrigger: (workspacePath, body) =>
        authedJson(TriggerSchema, `${workspacePath}/triggers`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      updateTrigger: (path, body) =>
        authedJson(TriggerSchema, path, { method: "PUT", body: JSON.stringify(body) }),
      deleteTrigger: (path) => authedVoid(path, { method: "DELETE" }),

      listVariables: (workspacePath) =>
        authedJson(ListVariablesResponseSchema, `${workspacePath}/variables`, { method: "GET" }),
      getVariable: (path) => authedJson(VariableSchema, path, { method: "GET" }),
      createVariable: (workspacePath, body) =>
        authedJson(VariableSchema, `${workspacePath}/variables`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      updateVariable: (path, body) =>
        authedJson(VariableSchema, path, { method: "PUT", body: JSON.stringify(body) }),
      deleteVariable: (path) => authedVoid(path, { method: "DELETE" }),

      listFolders: (workspacePath) =>
        authedJson(ListFoldersResponseSchema, `${workspacePath}/folders`, { method: "GET" }),
      getFolder: (path) => authedJson(FolderSchema, path, { method: "GET" }),
      createFolder: (workspacePath, body) =>
        authedJson(FolderSchema, `${workspacePath}/folders`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      updateFolder: (path, body) =>
        authedJson(FolderSchema, path, { method: "PUT", body: JSON.stringify(body) }),
      deleteFolder: (path) => authedVoid(path, { method: "DELETE" }),

      getWorkspaceStatus: (workspacePath) =>
        authedJson(GetWorkspaceStatusResponseSchema, `${workspacePath}/status`, {
          method: "GET",
        }),
      createContainerVersion: (workspacePath, body) =>
        authedJson(CreateContainerVersionResponseSchema, `${workspacePath}:create_version`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      getLiveContainerVersion: (containerPath) =>
        authedJson(ContainerVersionSchema, `${containerPath}/versions:live`, { method: "GET" }),
      getLatestContainerVersionHeader: (containerPath) =>
        authedJson(ContainerVersionHeaderSchema, `${containerPath}/version_headers:latest`, {
          method: "GET",
        }),
      publishContainerVersion: (path) =>
        authedJson(PublishContainerVersionResponseSchema, `${path}:publish`, { method: "POST" }),
      getContainerVersion: (path) => authedJson(ContainerVersionSchema, path, { method: "GET" }),
    } satisfies GtmHttpApi;
  }),
);

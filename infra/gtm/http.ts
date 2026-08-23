import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { CredentialsError, GtmCredentials } from "./credentials.ts";
import type {
  Account,
  Container as ContainerSchema,
  ListContainersResponse,
  ListTagsResponse,
  ListTriggersResponse,
  ListWorkspacesResponse,
  Tag as TagSchema,
  Trigger as TriggerSchema,
  Workspace as WorkspaceSchema,
} from "./schemas.ts";

export class NotFound extends Data.TaggedError("NotFound")<{
  message: string;
}> {}

export class Conflict extends Data.TaggedError("Conflict")<{
  message: string;
}> {}

export class InvalidArgument extends Data.TaggedError("InvalidArgument")<{
  message: string;
}> {}

export class HttpError extends Data.TaggedError("HttpError")<{
  message: string;
  status: number;
  body: string;
}> {}

type HttpMethodError = NotFound | InvalidArgument | Conflict | HttpError;

const GTM_BASE = "https://tagmanager.googleapis.com/tagmanager/v2";

export type GtmHttpApi = {
  getAccount: (path: string) => Effect.Effect<Account, HttpMethodError | CredentialsError>;
  listContainers: (
    accountPath: string,
  ) => Effect.Effect<ListContainersResponse, HttpMethodError | CredentialsError>;
  getContainer: (
    path: string,
  ) => Effect.Effect<ContainerSchema, HttpMethodError | CredentialsError>;
  createContainer: (
    accountPath: string,
    body: Partial<ContainerSchema>,
  ) => Effect.Effect<ContainerSchema, HttpMethodError | CredentialsError>;
  updateContainer: (
    path: string,
    body: Partial<ContainerSchema> & { fingerprint?: string },
  ) => Effect.Effect<ContainerSchema, HttpMethodError | CredentialsError>;
  deleteContainer: (path: string) => Effect.Effect<void, HttpMethodError | CredentialsError>;

  listWorkspaces: (
    containerPath: string,
  ) => Effect.Effect<ListWorkspacesResponse, HttpMethodError | CredentialsError>;
  getWorkspace: (
    path: string,
  ) => Effect.Effect<WorkspaceSchema, HttpMethodError | CredentialsError>;
  createWorkspace: (
    containerPath: string,
    body: Partial<WorkspaceSchema>,
  ) => Effect.Effect<WorkspaceSchema, HttpMethodError | CredentialsError>;
  updateWorkspace: (
    path: string,
    body: Partial<WorkspaceSchema> & { fingerprint?: string },
  ) => Effect.Effect<WorkspaceSchema, HttpMethodError | CredentialsError>;
  deleteWorkspace: (path: string) => Effect.Effect<void, HttpMethodError | CredentialsError>;

  listTags: (
    workspacePath: string,
  ) => Effect.Effect<ListTagsResponse, HttpMethodError | CredentialsError>;
  getTag: (path: string) => Effect.Effect<TagSchema, HttpMethodError | CredentialsError>;
  createTag: (
    workspacePath: string,
    body: Partial<TagSchema>,
  ) => Effect.Effect<TagSchema, HttpMethodError | CredentialsError>;
  updateTag: (
    path: string,
    body: Partial<TagSchema> & { fingerprint?: string },
  ) => Effect.Effect<TagSchema, HttpMethodError | CredentialsError>;
  deleteTag: (path: string) => Effect.Effect<void, HttpMethodError | CredentialsError>;

  listTriggers: (
    workspacePath: string,
  ) => Effect.Effect<ListTriggersResponse, HttpMethodError | CredentialsError>;
  getTrigger: (path: string) => Effect.Effect<TriggerSchema, HttpMethodError | CredentialsError>;
  createTrigger: (
    workspacePath: string,
    body: Partial<TriggerSchema>,
  ) => Effect.Effect<TriggerSchema, HttpMethodError | CredentialsError>;
  updateTrigger: (
    path: string,
    body: Partial<TriggerSchema> & { fingerprint?: string },
  ) => Effect.Effect<TriggerSchema, HttpMethodError | CredentialsError>;
  deleteTrigger: (path: string) => Effect.Effect<void, HttpMethodError | CredentialsError>;
};

export class GtmHttp extends Context.Service<GtmHttp, GtmHttpApi>()("GtmHttp") {}

const mapStatusToError = (status: number, body: string): HttpMethodError => {
  if (status === 404) return new NotFound({ message: body });
  if (status === 409) return new Conflict({ message: body });
  if (status === 400) return new InvalidArgument({ message: body });
  return new HttpError({ message: body, status, body });
};

const gtmFetch = (
  path: string,
  init: RequestInit,
  token: Redacted.Redacted,
): Effect.Effect<Response, HttpError> =>
  Effect.tryPromise({
    try: () =>
      fetch(`${GTM_BASE}/${path.replace(/^\//, "")}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${Redacted.value(token)}`,
          "Content-Type": "application/json",
          ...(init.headers as Record<string, string> | undefined),
        },
      }),
    catch: (cause) =>
      new HttpError({
        message: cause instanceof Error ? cause.message : String(cause),
        status: 0,
        body: String(cause),
      }),
  });

const jsonFetch = <T>(
  path: string,
  init: RequestInit,
  token: Redacted.Redacted,
): Effect.Effect<T, HttpMethodError> =>
  Effect.gen(function* () {
    const res = yield* gtmFetch(path, init, token);
    const text = yield* Effect.promise(() => res.text());
    if (!res.ok) return yield* mapStatusToError(res.status, text);
    return yield* Effect.try({
      try: () => JSON.parse(text) as T,
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

    return {
      getAccount: (path: string) =>
        authed((token) => jsonFetch<Account>(path, { method: "GET" }, token)),
      listContainers: (accountPath: string) =>
        authed((token) =>
          jsonFetch<ListContainersResponse>(`${accountPath}/containers`, { method: "GET" }, token),
        ),
      getContainer: (path: string) =>
        authed((token) => jsonFetch<ContainerSchema>(path, { method: "GET" }, token)),
      createContainer: (accountPath: string, body: Partial<ContainerSchema>) =>
        authed((token) =>
          jsonFetch<ContainerSchema>(
            `${accountPath}/containers`,
            { method: "POST", body: JSON.stringify(body) },
            token,
          ),
        ),
      updateContainer: (path: string, body: Partial<ContainerSchema> & { fingerprint?: string }) =>
        authed((token) =>
          jsonFetch<ContainerSchema>(path, { method: "PUT", body: JSON.stringify(body) }, token),
        ),
      deleteContainer: (path: string) =>
        authed((token) => voidFetch(path, { method: "DELETE" }, token)),

      listWorkspaces: (containerPath: string) =>
        authed((token) =>
          jsonFetch<ListWorkspacesResponse>(
            `${containerPath}/workspaces`,
            { method: "GET" },
            token,
          ),
        ),
      getWorkspace: (path: string) =>
        authed((token) => jsonFetch<WorkspaceSchema>(path, { method: "GET" }, token)),
      createWorkspace: (containerPath: string, body: Partial<WorkspaceSchema>) =>
        authed((token) =>
          jsonFetch<WorkspaceSchema>(
            `${containerPath}/workspaces`,
            { method: "POST", body: JSON.stringify(body) },
            token,
          ),
        ),
      updateWorkspace: (path: string, body: Partial<WorkspaceSchema> & { fingerprint?: string }) =>
        authed((token) =>
          jsonFetch<WorkspaceSchema>(path, { method: "PUT", body: JSON.stringify(body) }, token),
        ),
      deleteWorkspace: (path: string) =>
        authed((token) => voidFetch(path, { method: "DELETE" }, token)),

      listTags: (workspacePath: string) =>
        authed((token) =>
          jsonFetch<ListTagsResponse>(`${workspacePath}/tags`, { method: "GET" }, token),
        ),
      getTag: (path: string) =>
        authed((token) => jsonFetch<TagSchema>(path, { method: "GET" }, token)),
      createTag: (workspacePath: string, body: Partial<TagSchema>) =>
        authed((token) =>
          jsonFetch<TagSchema>(
            `${workspacePath}/tags`,
            { method: "POST", body: JSON.stringify(body) },
            token,
          ),
        ),
      updateTag: (path: string, body: Partial<TagSchema> & { fingerprint?: string }) =>
        authed((token) =>
          jsonFetch<TagSchema>(path, { method: "PUT", body: JSON.stringify(body) }, token),
        ),
      deleteTag: (path: string) => authed((token) => voidFetch(path, { method: "DELETE" }, token)),

      listTriggers: (workspacePath: string) =>
        authed((token) =>
          jsonFetch<ListTriggersResponse>(`${workspacePath}/triggers`, { method: "GET" }, token),
        ),
      getTrigger: (path: string) =>
        authed((token) => jsonFetch<TriggerSchema>(path, { method: "GET" }, token)),
      createTrigger: (workspacePath: string, body: Partial<TriggerSchema>) =>
        authed((token) =>
          jsonFetch<TriggerSchema>(
            `${workspacePath}/triggers`,
            { method: "POST", body: JSON.stringify(body) },
            token,
          ),
        ),
      updateTrigger: (path: string, body: Partial<TriggerSchema> & { fingerprint?: string }) =>
        authed((token) =>
          jsonFetch<TriggerSchema>(path, { method: "PUT", body: JSON.stringify(body) }, token),
        ),
      deleteTrigger: (path: string) =>
        authed((token) => voidFetch(path, { method: "DELETE" }, token)),
    } satisfies GtmHttpApi;
  }),
);

// ---------------------------------------------------------------------------
// Fake for unit tests
// ---------------------------------------------------------------------------

export type FakeState = {
  accounts: Map<string, Account>;
  containers: Map<string, ContainerSchema>;
  workspaces: Map<string, WorkspaceSchema>;
  tags: Map<string, TagSchema>;
  triggers: Map<string, TriggerSchema>;
  calls: Array<{ method: string; path: string }>;
};

export const makeFakeState = (): FakeState => ({
  accounts: new Map(),
  containers: new Map(),
  workspaces: new Map(),
  tags: new Map(),
  triggers: new Map(),
  calls: [],
});

const record = (state: FakeState, method: string, path: string): void => {
  state.calls.push({ method, path });
};

export const makeFakeGtmHttpLayer = (state: FakeState): Layer.Layer<GtmHttp> =>
  Layer.succeed(GtmHttp, {
    getAccount: (path: string) =>
      Effect.gen(function* () {
        record(state, "GET", path);
        const acc = state.accounts.get(path);
        if (!acc) return yield* new NotFound({ message: `account ${path} not found` });
        return acc;
      }),
    listContainers: (accountPath: string) =>
      Effect.sync(() => {
        record(state, "GET", `${accountPath}/containers`);
        const items = [...state.containers.values()].filter((c) =>
          c.path.startsWith(`${accountPath}/`),
        );
        return { container: items } satisfies ListContainersResponse;
      }),
    getContainer: (path: string) =>
      Effect.gen(function* () {
        record(state, "GET", path);
        const c = state.containers.get(path);
        if (!c) return yield* new NotFound({ message: `container ${path} not found` });
        return c;
      }),
    createContainer: (accountPath: string, body: Partial<ContainerSchema>) =>
      Effect.gen(function* () {
        record(state, "POST", `${accountPath}/containers`);
        const exists = [...state.containers.values()].find(
          (c) => c.path.startsWith(`${accountPath}/`) && c.name === body.name,
        );
        if (exists)
          return yield* new Conflict({ message: `container ${body.name} already exists` });
        const containerId = `C${Math.random().toString(36).slice(2, 8)}`;
        const path = `${accountPath}/containers/${containerId}`;
        const container: ContainerSchema = {
          path,
          accountId: accountPath.split("/")[1] ?? "unknown",
          containerId,
          name: body.name ?? "",
          publicId: `GTM-${containerId.toUpperCase()}`,
          fingerprint: `${Date.now()}`,
          tagManagerUrl: `https://tagmanager.google.com/#/container/${path}`,
        };
        if (body.domainName !== undefined) container.domainName = body.domainName;
        if (body.usageContext !== undefined) container.usageContext = body.usageContext;
        if (body.notes !== undefined) container.notes = body.notes;
        state.containers.set(path, container);
        return container;
      }),
    updateContainer: (path: string, body: Partial<ContainerSchema> & { fingerprint?: string }) =>
      Effect.gen(function* () {
        record(state, "PUT", path);
        const existing = state.containers.get(path);
        if (!existing) return yield* new NotFound({ message: `container ${path} not found` });
        const updated: ContainerSchema = {
          ...existing,
          ...body,
          path,
          fingerprint: `${Date.now()}`,
        };
        state.containers.set(path, updated);
        return updated;
      }),
    deleteContainer: (path: string) =>
      Effect.gen(function* () {
        record(state, "DELETE", path);
        if (!state.containers.has(path))
          return yield* new NotFound({ message: `container ${path} not found` });
        state.containers.delete(path);
      }),

    listWorkspaces: (containerPath: string) =>
      Effect.sync(() => {
        record(state, "GET", `${containerPath}/workspaces`);
        const items = [...state.workspaces.values()].filter((w) =>
          w.path.startsWith(`${containerPath}/`),
        );
        return { workspace: items } satisfies ListWorkspacesResponse;
      }),
    getWorkspace: (path: string) =>
      Effect.gen(function* () {
        record(state, "GET", path);
        const w = state.workspaces.get(path);
        if (!w) return yield* new NotFound({ message: `workspace ${path} not found` });
        return w;
      }),
    createWorkspace: (containerPath: string, body: Partial<WorkspaceSchema>) =>
      Effect.gen(function* () {
        record(state, "POST", `${containerPath}/workspaces`);
        const exists = [...state.workspaces.values()].find(
          (w) => w.path.startsWith(`${containerPath}/`) && w.name === body.name,
        );
        if (exists)
          return yield* new Conflict({ message: `workspace ${body.name} already exists` });
        const workspaceId = `${Math.floor(Math.random() * 10000)}`;
        const path = `${containerPath}/workspaces/${workspaceId}`;
        const workspace: WorkspaceSchema = {
          path,
          accountId: containerPath.split("/")[1] ?? "unknown",
          containerId: containerPath.split("/")[3] ?? "unknown",
          workspaceId,
          name: body.name ?? "",
          fingerprint: `${Date.now()}`,
          tagManagerUrl: `https://tagmanager.google.com/#/container/${containerPath}/workspace/${workspaceId}`,
        };
        if (body.description !== undefined) workspace.description = body.description;
        state.workspaces.set(path, workspace);
        return workspace;
      }),
    updateWorkspace: (path: string, body: Partial<WorkspaceSchema> & { fingerprint?: string }) =>
      Effect.gen(function* () {
        record(state, "PUT", path);
        const existing = state.workspaces.get(path);
        if (!existing) return yield* new NotFound({ message: `workspace ${path} not found` });
        const updated: WorkspaceSchema = {
          ...existing,
          ...body,
          path,
          fingerprint: `${Date.now()}`,
        };
        state.workspaces.set(path, updated);
        return updated;
      }),
    deleteWorkspace: (path: string) =>
      Effect.gen(function* () {
        record(state, "DELETE", path);
        if (!state.workspaces.has(path))
          return yield* new NotFound({ message: `workspace ${path} not found` });
        state.workspaces.delete(path);
      }),

    listTags: (workspacePath: string) =>
      Effect.sync(() => {
        record(state, "GET", `${workspacePath}/tags`);
        const items = [...state.tags.values()].filter((t) =>
          t.path.startsWith(`${workspacePath}/`),
        );
        return { tag: items } satisfies ListTagsResponse;
      }),
    getTag: (path: string) =>
      Effect.gen(function* () {
        record(state, "GET", path);
        const t = state.tags.get(path);
        if (!t) return yield* new NotFound({ message: `tag ${path} not found` });
        return t;
      }),
    createTag: (workspacePath: string, body: Partial<TagSchema>) =>
      Effect.gen(function* () {
        record(state, "POST", `${workspacePath}/tags`);
        const exists = [...state.tags.values()].find(
          (t) => t.path.startsWith(`${workspacePath}/`) && t.name === body.name,
        );
        if (exists) return yield* new Conflict({ message: `tag ${body.name} already exists` });
        const tagId = `${Math.floor(Math.random() * 100000)}`;
        const path = `${workspacePath}/tags/${tagId}`;
        const tag: TagSchema = {
          path,
          accountId: workspacePath.split("/")[1] ?? "unknown",
          containerId: workspacePath.split("/")[3] ?? "unknown",
          workspaceId: workspacePath.split("/")[5] ?? "unknown",
          tagId,
          name: body.name ?? "",
          type: body.type ?? "html",
          fingerprint: `${Date.now()}`,
          tagManagerUrl: `https://tagmanager.google.com/#/container/${workspacePath}/tag/${tagId}`,
        };
        if (body.parameter !== undefined) tag.parameter = body.parameter;
        if (body.firingTriggerId !== undefined) tag.firingTriggerId = body.firingTriggerId;
        if (body.blockingTriggerId !== undefined) tag.blockingTriggerId = body.blockingTriggerId;
        if (body.setupTag !== undefined) tag.setupTag = body.setupTag;
        if (body.teardownTag !== undefined) tag.teardownTag = body.teardownTag;
        if (body.parentFolderId !== undefined) tag.parentFolderId = body.parentFolderId;
        if (body.tagFiringOption !== undefined) tag.tagFiringOption = body.tagFiringOption;
        if (body.paused !== undefined) tag.paused = body.paused;
        if (body.notes !== undefined) tag.notes = body.notes;
        if (body.scheduleStartMs !== undefined) tag.scheduleStartMs = body.scheduleStartMs;
        if (body.scheduleEndMs !== undefined) tag.scheduleEndMs = body.scheduleEndMs;
        if (body.liveOnly !== undefined) tag.liveOnly = body.liveOnly;
        if (body.priority !== undefined) tag.priority = body.priority;
        if (body.consentSettings !== undefined) tag.consentSettings = body.consentSettings;
        state.tags.set(path, tag);
        return tag;
      }),
    updateTag: (path: string, body: Partial<TagSchema> & { fingerprint?: string }) =>
      Effect.gen(function* () {
        record(state, "PUT", path);
        const existing = state.tags.get(path);
        if (!existing) return yield* new NotFound({ message: `tag ${path} not found` });
        const updated: TagSchema = {
          ...existing,
          ...body,
          path,
          fingerprint: `${Date.now()}`,
        };
        state.tags.set(path, updated);
        return updated;
      }),
    deleteTag: (path: string) =>
      Effect.gen(function* () {
        record(state, "DELETE", path);
        if (!state.tags.has(path)) return yield* new NotFound({ message: `tag ${path} not found` });
        state.tags.delete(path);
      }),

    listTriggers: (workspacePath: string) =>
      Effect.sync(() => {
        record(state, "GET", `${workspacePath}/triggers`);
        const items = [...state.triggers.values()].filter((t) =>
          t.path.startsWith(`${workspacePath}/`),
        );
        return { trigger: items } satisfies ListTriggersResponse;
      }),
    getTrigger: (path: string) =>
      Effect.gen(function* () {
        record(state, "GET", path);
        const t = state.triggers.get(path);
        if (!t) return yield* new NotFound({ message: `trigger ${path} not found` });
        return t;
      }),
    createTrigger: (workspacePath: string, body: Partial<TriggerSchema>) =>
      Effect.gen(function* () {
        record(state, "POST", `${workspacePath}/triggers`);
        const exists = [...state.triggers.values()].find(
          (t) => t.path.startsWith(`${workspacePath}/`) && t.name === body.name,
        );
        if (exists) return yield* new Conflict({ message: `trigger ${body.name} already exists` });
        const triggerId = `${Math.floor(Math.random() * 100000)}`;
        const path = `${workspacePath}/triggers/${triggerId}`;
        const trigger: TriggerSchema = {
          path,
          accountId: workspacePath.split("/")[1] ?? "unknown",
          containerId: workspacePath.split("/")[3] ?? "unknown",
          workspaceId: workspacePath.split("/")[5] ?? "unknown",
          triggerId,
          name: body.name ?? "",
          type: body.type ?? "customEvent",
          fingerprint: `${Date.now()}`,
          tagManagerUrl: `https://tagmanager.google.com/#/container/${workspacePath}/trigger/${triggerId}`,
        };
        if (body.parameter !== undefined) trigger.parameter = body.parameter;
        if (body.filter !== undefined) trigger.filter = body.filter;
        if (body.customEventFilter !== undefined)
          trigger.customEventFilter = body.customEventFilter;
        if (body.parentFolderId !== undefined) trigger.parentFolderId = body.parentFolderId;
        if (body.notes !== undefined) trigger.notes = body.notes;
        state.triggers.set(path, trigger);
        return trigger;
      }),
    updateTrigger: (path: string, body: Partial<TriggerSchema> & { fingerprint?: string }) =>
      Effect.gen(function* () {
        record(state, "PUT", path);
        const existing = state.triggers.get(path);
        if (!existing) return yield* new NotFound({ message: `trigger ${path} not found` });
        const updated: TriggerSchema = {
          ...existing,
          ...body,
          path,
          fingerprint: `${Date.now()}`,
        };
        state.triggers.set(path, updated);
        return updated;
      }),
    deleteTrigger: (path: string) =>
      Effect.gen(function* () {
        record(state, "DELETE", path);
        if (!state.triggers.has(path))
          return yield* new NotFound({ message: `trigger ${path} not found` });
        state.triggers.delete(path);
      }),
  });

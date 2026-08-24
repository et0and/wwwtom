import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { GtmHttp } from "./http.ts";
import { Conflict, NotFound } from "./errors.ts";
import type {
  Account,
  Container,
  ContainerVersion,
  ContainerVersionHeader,
  CreateContainerVersionResponse,
  Folder,
  GetWorkspaceStatusResponse,
  ListContainersResponse,
  ListFoldersResponse,
  ListTagsResponse,
  ListTriggersResponse,
  ListVariablesResponse,
  ListWorkspacesResponse,
  PublishContainerVersionResponse,
  Tag,
  Trigger,
  Variable,
  Workspace,
} from "./schemas.ts";

export type GtmCall = {
  readonly method: "GET" | "POST" | "PUT" | "DELETE";
  readonly path: string;
};

export type FakeState = {
  readonly accounts: Map<string, Account>;
  readonly containers: Map<string, Container>;
  readonly workspaces: Map<string, Workspace>;
  readonly tags: Map<string, Tag>;
  readonly triggers: Map<string, Trigger>;
  readonly variables: Map<string, Variable>;
  readonly folders: Map<string, Folder>;
  readonly containerVersions: Map<string, ContainerVersion>;
  readonly dirtyWorkspaces: Set<string>;
  readonly liveVersions: Map<string, string>;
  readonly calls: GtmCall[];
};

export const makeFakeState = (): FakeState => ({
  accounts: new Map(),
  containers: new Map(),
  workspaces: new Map(),
  tags: new Map(),
  triggers: new Map(),
  variables: new Map(),
  folders: new Map(),
  containerVersions: new Map(),
  dirtyWorkspaces: new Set(),
  liveVersions: new Map(),
  calls: [],
});

const record = (state: FakeState, method: GtmCall["method"], path: string): void => {
  state.calls.push({ method, path });
};

const mergeDefined = <T extends object>(base: T, draft: Partial<T>): T => {
  let result = base;
  for (const key in draft) {
    if (Object.hasOwn(draft, key)) {
      const value = draft[key as keyof T];
      if (value !== undefined) {
        // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type, anti-slop/no-known-value-widening -- single boundary merging defined draft fields; Struct-like logic
        result = { ...result, [key]: value } as T;
      }
    }
  }
  return result;
};

export const makeFakeGtmHttpLayer = (state: FakeState): Layer.Layer<GtmHttp> =>
  Layer.succeed(GtmHttp, {
    getAccount: (path) =>
      Effect.gen(function* () {
        record(state, "GET", path);
        const acc = state.accounts.get(path);
        if (!acc) return yield* new NotFound({ message: `account ${path} not found` });
        return acc;
      }),
    listContainers: (accountPath) =>
      Effect.sync(() => {
        record(state, "GET", `${accountPath}/containers`);
        const items = [...state.containers.values()].filter((c) =>
          c.path.startsWith(`${accountPath}/`),
        );
        return { container: items } satisfies ListContainersResponse;
      }),
    getContainer: (path) =>
      Effect.gen(function* () {
        record(state, "GET", path);
        const c = state.containers.get(path);
        if (!c) return yield* new NotFound({ message: `container ${path} not found` });
        return c;
      }),
    createContainer: (accountPath, body) =>
      Effect.gen(function* () {
        record(state, "POST", `${accountPath}/containers`);
        const exists = [...state.containers.values()].find(
          (c) => c.path.startsWith(`${accountPath}/`) && c.name === body.name,
        );
        if (exists)
          return yield* new Conflict({ message: `container ${body.name} already exists` });
        const containerId = `C${Math.random().toString(36).slice(2, 8)}`;
        const path = `${accountPath}/containers/${containerId}`;
        const base: Container = {
          path,
          accountId: accountPath.split("/")[1] ?? "unknown",
          containerId,
          name: body.name ?? "",
          publicId: `GTM-${containerId.toUpperCase()}`,
          fingerprint: `${Date.now()}`,
          tagManagerUrl: `https://tagmanager.google.com/#/container/${path}`,
        };
        const container = mergeDefined(base, body as Partial<Container>);
        state.containers.set(path, container);
        return container;
      }),
    updateContainer: (path, body) =>
      Effect.gen(function* () {
        record(state, "PUT", path);
        const existing = state.containers.get(path);
        if (!existing) return yield* new NotFound({ message: `container ${path} not found` });
        const updated: Container = {
          ...mergeDefined(existing, body as Partial<Container>),
          path,
          fingerprint: `${Date.now()}`,
        };
        state.containers.set(path, updated);
        return updated;
      }),
    deleteContainer: (path) =>
      Effect.gen(function* () {
        record(state, "DELETE", path);
        if (!state.containers.has(path))
          return yield* new NotFound({ message: `container ${path} not found` });
        state.containers.delete(path);
      }),

    listWorkspaces: (containerPath) =>
      Effect.sync(() => {
        record(state, "GET", `${containerPath}/workspaces`);
        const items = [...state.workspaces.values()].filter((w) =>
          w.path.startsWith(`${containerPath}/`),
        );
        return { workspace: items } satisfies ListWorkspacesResponse;
      }),
    getWorkspace: (path) =>
      Effect.gen(function* () {
        record(state, "GET", path);
        const w = state.workspaces.get(path);
        if (!w) return yield* new NotFound({ message: `workspace ${path} not found` });
        return w;
      }),
    createWorkspace: (containerPath, body) =>
      Effect.gen(function* () {
        record(state, "POST", `${containerPath}/workspaces`);
        const exists = [...state.workspaces.values()].find(
          (w) => w.path.startsWith(`${containerPath}/`) && w.name === body.name,
        );
        if (exists)
          return yield* new Conflict({ message: `workspace ${body.name} already exists` });
        const workspaceId = `${Math.floor(Math.random() * 10000)}`;
        const path = `${containerPath}/workspaces/${workspaceId}`;
        const base: Workspace = {
          path,
          accountId: containerPath.split("/")[1] ?? "unknown",
          containerId: containerPath.split("/")[3] ?? "unknown",
          workspaceId,
          name: body.name ?? "",
          fingerprint: `${Date.now()}`,
          tagManagerUrl: `https://tagmanager.google.com/#/container/${containerPath}/workspace/${workspaceId}`,
        };
        const workspace = mergeDefined(base, body as Partial<Workspace>);
        state.workspaces.set(path, workspace);
        return workspace;
      }),
    updateWorkspace: (path, body) =>
      Effect.gen(function* () {
        record(state, "PUT", path);
        const existing = state.workspaces.get(path);
        if (!existing) return yield* new NotFound({ message: `workspace ${path} not found` });
        const updated: Workspace = {
          ...mergeDefined(existing, body as Partial<Workspace>),
          path,
          fingerprint: `${Date.now()}`,
        };
        state.workspaces.set(path, updated);
        return updated;
      }),
    deleteWorkspace: (path) =>
      Effect.gen(function* () {
        record(state, "DELETE", path);
        if (!state.workspaces.has(path))
          return yield* new NotFound({ message: `workspace ${path} not found` });
        state.workspaces.delete(path);
      }),

    listTags: (workspacePath) =>
      Effect.sync(() => {
        record(state, "GET", `${workspacePath}/tags`);
        const items = [...state.tags.values()].filter((t) =>
          t.path.startsWith(`${workspacePath}/`),
        );
        return { tag: items } satisfies ListTagsResponse;
      }),
    getTag: (path) =>
      Effect.gen(function* () {
        record(state, "GET", path);
        const t = state.tags.get(path);
        if (!t) return yield* new NotFound({ message: `tag ${path} not found` });
        return t;
      }),
    createTag: (workspacePath, body) =>
      Effect.gen(function* () {
        record(state, "POST", `${workspacePath}/tags`);
        const exists = [...state.tags.values()].find(
          (t) => t.path.startsWith(`${workspacePath}/`) && t.name === body.name,
        );
        if (exists) return yield* new Conflict({ message: `tag ${body.name} already exists` });
        const tagId = `${Math.floor(Math.random() * 100000)}`;
        const path = `${workspacePath}/tags/${tagId}`;
        const base: Tag = {
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
        const tag = mergeDefined(base, body as Partial<Tag>);
        state.tags.set(path, tag);
        state.dirtyWorkspaces.add(workspacePath);
        return tag;
      }),
    updateTag: (path, body) =>
      Effect.gen(function* () {
        record(state, "PUT", path);
        const existing = state.tags.get(path);
        if (!existing) return yield* new NotFound({ message: `tag ${path} not found` });
        const updated: Tag = {
          ...mergeDefined(existing, body as Partial<Tag>),
          path,
          fingerprint: `${Date.now()}`,
        };
        state.tags.set(path, updated);
        state.dirtyWorkspaces.add(path.split("/tags/")[0] ?? "");
        return updated;
      }),
    deleteTag: (path) =>
      Effect.gen(function* () {
        record(state, "DELETE", path);
        if (!state.tags.has(path)) return yield* new NotFound({ message: `tag ${path} not found` });
        state.tags.delete(path);
        state.dirtyWorkspaces.add(path.split("/tags/")[0] ?? "");
      }),

    listTriggers: (workspacePath) =>
      Effect.sync(() => {
        record(state, "GET", `${workspacePath}/triggers`);
        const items = [...state.triggers.values()].filter((t) =>
          t.path.startsWith(`${workspacePath}/`),
        );
        return { trigger: items } satisfies ListTriggersResponse;
      }),
    getTrigger: (path) =>
      Effect.gen(function* () {
        record(state, "GET", path);
        const t = state.triggers.get(path);
        if (!t) return yield* new NotFound({ message: `trigger ${path} not found` });
        return t;
      }),
    createTrigger: (workspacePath, body) =>
      Effect.gen(function* () {
        record(state, "POST", `${workspacePath}/triggers`);
        const exists = [...state.triggers.values()].find(
          (t) => t.path.startsWith(`${workspacePath}/`) && t.name === body.name,
        );
        if (exists) return yield* new Conflict({ message: `trigger ${body.name} already exists` });
        const triggerId = `${Math.floor(Math.random() * 100000)}`;
        const path = `${workspacePath}/triggers/${triggerId}`;
        const base: Trigger = {
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
        const trigger = mergeDefined(base, body as Partial<Trigger>);
        state.triggers.set(path, trigger);
        state.dirtyWorkspaces.add(workspacePath);
        return trigger;
      }),
    updateTrigger: (path, body) =>
      Effect.gen(function* () {
        record(state, "PUT", path);
        const existing = state.triggers.get(path);
        if (!existing) return yield* new NotFound({ message: `trigger ${path} not found` });
        const updated: Trigger = {
          ...mergeDefined(existing, body as Partial<Trigger>),
          path,
          fingerprint: `${Date.now()}`,
        };
        state.triggers.set(path, updated);
        state.dirtyWorkspaces.add(path.split("/triggers/")[0] ?? "");
        return updated;
      }),
    deleteTrigger: (path) =>
      Effect.gen(function* () {
        record(state, "DELETE", path);
        if (!state.triggers.has(path))
          return yield* new NotFound({ message: `trigger ${path} not found` });
        state.triggers.delete(path);
        state.dirtyWorkspaces.add(path.split("/triggers/")[0] ?? "");
      }),

    listVariables: (workspacePath) =>
      Effect.sync(() => {
        record(state, "GET", `${workspacePath}/variables`);
        const items = [...state.variables.values()].filter((v) =>
          v.path.startsWith(`${workspacePath}/`),
        );
        return { variable: items } satisfies ListVariablesResponse;
      }),
    getVariable: (path) =>
      Effect.gen(function* () {
        record(state, "GET", path);
        const v = state.variables.get(path);
        if (!v) return yield* new NotFound({ message: `variable ${path} not found` });
        return v;
      }),
    createVariable: (workspacePath, body) =>
      Effect.gen(function* () {
        record(state, "POST", `${workspacePath}/variables`);
        const exists = [...state.variables.values()].find(
          (v) => v.path.startsWith(`${workspacePath}/`) && v.name === body.name,
        );
        if (exists) return yield* new Conflict({ message: `variable ${body.name} already exists` });
        const variableId = `${Math.floor(Math.random() * 100000)}`;
        const path = `${workspacePath}/variables/${variableId}`;
        const base: Variable = {
          path,
          accountId: workspacePath.split("/")[1] ?? "unknown",
          containerId: workspacePath.split("/")[3] ?? "unknown",
          workspaceId: workspacePath.split("/")[5] ?? "unknown",
          variableId,
          name: body.name ?? "",
          type: body.type ?? "v",
          fingerprint: `${Date.now()}`,
          tagManagerUrl: `https://tagmanager.google.com/#/container/${workspacePath}/variable/${variableId}`,
        };
        const variable = mergeDefined(base, body as Partial<Variable>);
        state.variables.set(path, variable);
        state.dirtyWorkspaces.add(workspacePath);
        return variable;
      }),
    updateVariable: (path, body) =>
      Effect.gen(function* () {
        record(state, "PUT", path);
        const existing = state.variables.get(path);
        if (!existing) return yield* new NotFound({ message: `variable ${path} not found` });
        const updated: Variable = {
          ...mergeDefined(existing, body as Partial<Variable>),
          path,
          fingerprint: `${Date.now()}`,
        };
        state.variables.set(path, updated);
        state.dirtyWorkspaces.add(path.split("/variables/")[0] ?? "");
        return updated;
      }),
    deleteVariable: (path) =>
      Effect.gen(function* () {
        record(state, "DELETE", path);
        if (!state.variables.has(path))
          return yield* new NotFound({ message: `variable ${path} not found` });
        state.variables.delete(path);
        state.dirtyWorkspaces.add(path.split("/variables/")[0] ?? "");
      }),

    listFolders: (workspacePath) =>
      Effect.sync(() => {
        record(state, "GET", `${workspacePath}/folders`);
        const items = [...state.folders.values()].filter((f) =>
          f.path.startsWith(`${workspacePath}/`),
        );
        return { folder: items } satisfies ListFoldersResponse;
      }),
    getFolder: (path) =>
      Effect.gen(function* () {
        record(state, "GET", path);
        const f = state.folders.get(path);
        if (!f) return yield* new NotFound({ message: `folder ${path} not found` });
        return f;
      }),
    createFolder: (workspacePath, body) =>
      Effect.gen(function* () {
        record(state, "POST", `${workspacePath}/folders`);
        const exists = [...state.folders.values()].find(
          (f) => f.path.startsWith(`${workspacePath}/`) && f.name === body.name,
        );
        if (exists) return yield* new Conflict({ message: `folder ${body.name} already exists` });
        const folderId = `${Math.floor(Math.random() * 100000)}`;
        const path = `${workspacePath}/folders/${folderId}`;
        const base: Folder = {
          path,
          accountId: workspacePath.split("/")[1] ?? "unknown",
          containerId: workspacePath.split("/")[3] ?? "unknown",
          workspaceId: workspacePath.split("/")[5] ?? "unknown",
          folderId,
          name: body.name ?? "",
          fingerprint: `${Date.now()}`,
          tagManagerUrl: `https://tagmanager.google.com/#/container/${workspacePath}/folder/${folderId}`,
        };
        const folder = mergeDefined(base, body as Partial<Folder>);
        state.folders.set(path, folder);
        state.dirtyWorkspaces.add(workspacePath);
        return folder;
      }),
    updateFolder: (path, body) =>
      Effect.gen(function* () {
        record(state, "PUT", path);
        const existing = state.folders.get(path);
        if (!existing) return yield* new NotFound({ message: `folder ${path} not found` });
        const updated: Folder = {
          ...mergeDefined(existing, body as Partial<Folder>),
          path,
          fingerprint: `${Date.now()}`,
        };
        state.folders.set(path, updated);
        state.dirtyWorkspaces.add(path.split("/folders/")[0] ?? "");
        return updated;
      }),
    deleteFolder: (path) =>
      Effect.gen(function* () {
        record(state, "DELETE", path);
        if (!state.folders.has(path))
          return yield* new NotFound({ message: `folder ${path} not found` });
        state.folders.delete(path);
        state.dirtyWorkspaces.add(path.split("/folders/")[0] ?? "");
      }),

    getWorkspaceStatus: (workspacePath) =>
      Effect.sync(() => {
        record(state, "GET", `${workspacePath}/status`);
        const isDirty = state.dirtyWorkspaces.has(workspacePath);
        return {
          workspaceChange: isDirty ? [{ type: "workspaceChange" }] : [],
        } satisfies GetWorkspaceStatusResponse;
      }),
    createContainerVersion: (workspacePath, body) =>
      Effect.sync(() => {
        record(state, "POST", `${workspacePath}:create_version`);
        const containerPath = workspacePath.split("/workspaces/")[0] ?? workspacePath;
        const containerVersionId = `${Math.floor(Math.random() * 100000)}`;
        const path = `${containerPath}/versions/${containerVersionId}`;
        const version: ContainerVersion = {
          path,
          accountId: workspacePath.split("/")[1] ?? "unknown",
          containerId: workspacePath.split("/")[3] ?? "unknown",
          containerVersionId,
          name: body.name,
          description: body.notes,
          fingerprint: `${Date.now()}`,
          tagManagerUrl: `https://tagmanager.google.com/#/container/${containerPath}/version/${containerVersionId}`,
        };
        state.containerVersions.set(path, version);
        state.dirtyWorkspaces.delete(workspacePath);
        return {
          containerVersion: version,
          compilerError: false,
        } satisfies CreateContainerVersionResponse;
      }),
    getLiveContainerVersion: (containerPath) =>
      Effect.gen(function* () {
        record(state, "GET", `${containerPath}/versions:live`);
        const livePath = state.liveVersions.get(containerPath);
        if (!livePath)
          return yield* new NotFound({ message: `live version for ${containerPath} not found` });
        const v = state.containerVersions.get(livePath);
        if (!v) return yield* new NotFound({ message: `live version ${livePath} not found` });
        return v;
      }),
    getLatestContainerVersionHeader: (containerPath) =>
      Effect.gen(function* () {
        record(state, "GET", `${containerPath}/version_headers:latest`);
        const headers = [...state.containerVersions.values()]
          .filter((v) => v.path.startsWith(`${containerPath}/versions/`))
          .sort((a, b) => Number(b.containerVersionId) - Number(a.containerVersionId));
        const latest = headers[0];
        if (!latest) return yield* new NotFound({ message: `no versions for ${containerPath}` });
        return {
          path: latest.path,
          accountId: latest.accountId,
          containerId: latest.containerId,
          containerVersionId: latest.containerVersionId,
          name: latest.name,
        } satisfies ContainerVersionHeader;
      }),
    publishContainerVersion: (path) =>
      Effect.gen(function* () {
        record(state, "POST", `${path}:publish`);
        const v = state.containerVersions.get(path);
        if (!v) return yield* new NotFound({ message: `version ${path} not found` });
        const containerPath = path.split("/versions/")[0] ?? path;
        state.liveVersions.set(containerPath, path);
        return {
          containerVersion: v,
          compilerError: false,
        } satisfies PublishContainerVersionResponse;
      }),
    getContainerVersion: (path) =>
      Effect.gen(function* () {
        record(state, "GET", path);
        const v = state.containerVersions.get(path);
        if (!v) return yield* new NotFound({ message: `version ${path} not found` });
        return v;
      }),
  });

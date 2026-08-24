import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { GtmHttp } from "./http.ts";
import { Conflict, NotFound } from "./errors.ts";
import type {
  Account,
  Container,
  ListContainersResponse,
  ListTagsResponse,
  ListTriggersResponse,
  ListWorkspacesResponse,
  Tag,
  Trigger,
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
  readonly calls: GtmCall[];
};

export const makeFakeState = (): FakeState => ({
  accounts: new Map(),
  containers: new Map(),
  workspaces: new Map(),
  tags: new Map(),
  triggers: new Map(),
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
        return updated;
      }),
    deleteTag: (path) =>
      Effect.gen(function* () {
        record(state, "DELETE", path);
        if (!state.tags.has(path)) return yield* new NotFound({ message: `tag ${path} not found` });
        state.tags.delete(path);
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
        return updated;
      }),
    deleteTrigger: (path) =>
      Effect.gen(function* () {
        record(state, "DELETE", path);
        if (!state.triggers.has(path))
          return yield* new NotFound({ message: `trigger ${path} not found` });
        state.triggers.delete(path);
      }),
  });

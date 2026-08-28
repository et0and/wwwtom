import { describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Unowned } from "alchemy/AdoptPolicy";
import { Variable, VariableProvider, type VariableProps } from "../variable.ts";
import { Trigger, TriggerProvider } from "../trigger.ts";
import { Folder, FolderProvider } from "../folder.ts";
import { makeFakeState } from "../fake.ts";
import { findGtmProvider, makeTestLayer, testSession } from "./driver.ts";

const withVariableProvider = (state: ReturnType<typeof makeFakeState>) =>
  Layer.provideMerge(VariableProvider(), makeTestLayer(state));

const withTriggerProvider = (state: ReturnType<typeof makeFakeState>) =>
  Layer.provideMerge(TriggerProvider(), makeTestLayer(state));

const withFolderProvider = (state: ReturnType<typeof makeFakeState>) =>
  Layer.provideMerge(FolderProvider(), makeTestLayer(state));

const reconcileVariable = async (
  state: ReturnType<typeof makeFakeState>,
  props: VariableProps,
  id = "my-var",
): Promise<unknown> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const provider = yield* findGtmProvider(Variable);
      return yield* provider.reconcile({
        id,
        fqn: `Gtm.Variable/${id}`,
        instanceId: "test-instance",
        news: props,
        olds: undefined,
        output: undefined,
        session: testSession,
        bindings: [],
      });
    }).pipe(Effect.provide(withVariableProvider(state))),
  );

const reconcileTrigger = async (
  state: ReturnType<typeof makeFakeState>,
  props: { workspacePath: string; name: string; type: string },
  id = "my-trigger",
): Promise<unknown> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const provider = yield* findGtmProvider(Trigger);
      return yield* provider.reconcile({
        id,
        fqn: `Gtm.Trigger/${id}`,
        instanceId: "test-instance",
        news: props as never,
        olds: undefined,
        output: undefined,
        session: testSession,
        bindings: [],
      });
    }).pipe(Effect.provide(withTriggerProvider(state))),
  );

const reconcileFolder = async (
  state: ReturnType<typeof makeFakeState>,
  props: { workspacePath: string; name: string },
  id = "my-folder",
): Promise<unknown> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const provider = yield* findGtmProvider(Folder);
      return yield* provider.reconcile({
        id,
        fqn: `Gtm.Folder/${id}`,
        instanceId: "test-instance",
        news: props as never,
        olds: undefined,
        output: undefined,
        session: testSession,
        bindings: [],
      });
    }).pipe(Effect.provide(withFolderProvider(state))),
  );

describe("Variable provider", () => {
  it("creates variable with parameters and formatValue", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    const attrs = (await reconcileVariable(state, {
      workspacePath: ws,
      name: "myVar",
      type: "template",
      parameter: [{ type: "template", key: "value", value: "hello" }],
      formatValue: { convertToBoolean: true },
    })) as { variableId: string; path: string; formatValue: unknown };
    expect(attrs.variableId).toBeDefined();
    expect(attrs.path).toContain(ws);
    expect(attrs.formatValue).toEqual({ convertToBoolean: true });
    expect(state.calls.some((c) => c.method === "POST" && c.path === `${ws}/variables`)).toBe(true);
  });

  it("wires enabling/disabling triggers via triggerId", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    const trig = (await reconcileTrigger(state, {
      workspacePath: ws,
      name: "evt",
      type: "customEvent",
    })) as {
      triggerId: string;
    };
    const v = (await reconcileVariable(state, {
      workspacePath: ws,
      name: "condVar",
      type: "c",
      enablingTriggerId: [trig.triggerId],
      disablingTriggerId: [trig.triggerId],
    })) as { enablingTriggerId: string[]; disablingTriggerId: string[] };
    expect(v.enablingTriggerId).toEqual([trig.triggerId]);
    expect(v.disablingTriggerId).toEqual([trig.triggerId]);
  });

  it("references parentFolderId", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    const folder = (await reconcileFolder(state, { workspacePath: ws, name: "my-folder" })) as {
      folderId: string;
    };
    const v = (await reconcileVariable(state, {
      workspacePath: ws,
      name: "folderVar",
      type: "v",
      parentFolderId: folder.folderId,
    })) as { parentFolderId: string };
    expect(v.parentFolderId).toBe(folder.folderId);
  });

  it("updates with fingerprint", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    const created = (await reconcileVariable(state, {
      workspacePath: ws,
      name: "myVar",
      type: "v",
    })) as { fingerprint: string };
    state.calls.length = 0;
    await new Promise((r) => setTimeout(r, 2));
    const updated = (await reconcileVariable(state, {
      workspacePath: ws,
      name: "myVar",
      type: "v",
      notes: "updated",
    })) as { notes: string; fingerprint: string };
    expect(updated.notes).toBe("updated");
    expect(state.calls.some((c) => c.method === "PUT")).toBe(true);
    expect(updated.fingerprint).not.toBe(created.fingerprint);
  });

  it("read marks foreign variable as Unowned", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    state.variables.set(`${ws}/variables/1`, {
      path: `${ws}/variables/1`,
      accountId: "123",
      containerId: "C1",
      workspaceId: "1",
      variableId: "1",
      name: "myVar",
      type: "v",
      fingerprint: "1",
      tagManagerUrl: "https://tagmanager.google.com/",
      notes: "foreign",
    });
    const result: unknown = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findGtmProvider(Variable);
        return yield* provider.read({
          id: "myVar",
          fqn: "Gtm.Variable/myVar",
          instanceId: "test-instance",
          olds: { workspacePath: ws, name: "myVar", type: "v" },
          output: undefined,
        });
      }).pipe(Effect.provide(withVariableProvider(state))),
    );
    expect(Unowned.is(result)).toBe(true);
  });

  it("delete removes variable", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    const created = (await reconcileVariable(state, {
      workspacePath: ws,
      name: "myVar",
      type: "v",
    })) as { path: string };
    await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findGtmProvider(Variable);
        yield* provider.delete({
          id: "myVar",
          fqn: "Gtm.Variable/myVar",
          instanceId: "test-instance",
          olds: { workspacePath: ws, name: "myVar", type: "v" },
          output: {
            accountId: "123",
            containerId: "C1",
            workspaceId: "1",
            variableId: "1",
            path: created.path,
            name: "myVar",
            type: "v",
            notes: "",
            fingerprint: "1",
            tagManagerUrl: "",
          },
          session: testSession,
          bindings: [],
        });
      }).pipe(Effect.provide(withVariableProvider(state))),
    );
    expect(state.variables.has(created.path)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Unowned } from "alchemy/AdoptPolicy";
import { Workspace, WorkspaceProvider, type WorkspaceProps } from "../workspace.ts";
import { makeFakeState } from "../http.ts";
import { findGtmProvider, makeTestLayer, testSession } from "./driver.ts";

const withProvider = (state: ReturnType<typeof makeFakeState>) =>
  Layer.provideMerge(WorkspaceProvider(), makeTestLayer(state));

const reconcile = async (
  state: ReturnType<typeof makeFakeState>,
  props: WorkspaceProps,
  id = "my-ws",
): Promise<unknown> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const provider = yield* findGtmProvider(Workspace);
      return yield* provider.reconcile({
        id,
        fqn: `Gtm.Workspace/${id}`,
        instanceId: "test-instance",
        news: props,
        olds: undefined,
        output: undefined,
        session: testSession,
        bindings: [],
      });
    }).pipe(Effect.provide(withProvider(state))),
  );

describe("Workspace provider", () => {
  it("creates when absent", async () => {
    const state = makeFakeState();
    const attrs = (await reconcile(state, {
      containerPath: "accounts/123/containers/C1",
      name: "ws-1",
    })) as { path: string; name: string };
    expect(attrs.path).toContain("accounts/123/containers/C1/workspaces/");
    expect(attrs.name).toBe("ws-1");
    expect(state.calls.some((c) => c.method === "POST")).toBe(true);
  });

  it("updates with fingerprint", async () => {
    const state = makeFakeState();
    await reconcile(state, {
      containerPath: "accounts/123/containers/C1",
      name: "ws-1",
      description: "a",
    });
    state.calls.length = 0;
    await new Promise((r) => setTimeout(r, 2));
    const updated = (await reconcile(state, {
      containerPath: "accounts/123/containers/C1",
      name: "ws-1",
      description: "b",
    })) as { description: string };
    expect(updated.description).toBe("b");
    expect(state.calls.some((c) => c.method === "PUT")).toBe(true);
  });

  it("idempotent when unchanged", async () => {
    const state = makeFakeState();
    await reconcile(state, {
      containerPath: "accounts/123/containers/C1",
      name: "ws-1",
      description: "a",
    });
    state.calls.length = 0;
    await reconcile(state, {
      containerPath: "accounts/123/containers/C1",
      name: "ws-1",
      description: "a",
    });
    expect(state.calls.filter((c) => c.method === "PUT").length).toBe(0);
  });

  it("read marks foreign same-name workspace as Unowned", async () => {
    const state = makeFakeState();
    state.workspaces.set("accounts/123/containers/C1/workspaces/1", {
      path: "accounts/123/containers/C1/workspaces/1",
      accountId: "123",
      containerId: "C1",
      workspaceId: "1",
      name: "ws-1",
      description: "foreign",
      fingerprint: "1",
      tagManagerUrl: "https://tagmanager.google.com/",
    });

    const result: unknown = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findGtmProvider(Workspace);
        return yield* provider.read({
          id: "ws-1",
          fqn: "Gtm.Workspace/ws-1",
          instanceId: "test-instance",
          olds: { containerPath: "accounts/123/containers/C1", name: "ws-1" },
          output: undefined,
        });
      }).pipe(Effect.provide(withProvider(state))),
    );

    expect(Unowned.is(result)).toBe(true);
  });

  it("delete removes workspace", async () => {
    const state = makeFakeState();
    const created = (await reconcile(state, {
      containerPath: "accounts/123/containers/C1",
      name: "ws-1",
    })) as { path: string };
    await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findGtmProvider(Workspace);
        yield* provider.delete({
          id: "ws-1",
          fqn: "Gtm.Workspace/ws-1",
          instanceId: "test-instance",
          olds: { containerPath: "accounts/123/containers/C1", name: "ws-1" },
          output: {
            accountId: "123",
            containerId: "C1",
            workspaceId: "1",
            path: created.path,
            name: "ws-1",
            description: "",
            fingerprint: "1",
            tagManagerUrl: "",
          },
          session: testSession,
          bindings: [],
        });
      }).pipe(Effect.provide(withProvider(state))),
    );
    expect(state.workspaces.has(created.path)).toBe(false);
  });

  it("diff flags replace on containerPath change", async () => {
    const state = makeFakeState();
    const result: unknown = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findGtmProvider(Workspace);
        return yield* provider.diff({
          id: "ws-1",
          fqn: "Gtm.Workspace/ws-1",
          instanceId: "test-instance",
          olds: { containerPath: "accounts/123/containers/C1", name: "ws-1" },
          news: { containerPath: "accounts/123/containers/C2", name: "ws-1" },
          oldBindings: [],
          newBindings: [],
          output: {
            accountId: "123",
            containerId: "C1",
            workspaceId: "1",
            path: "accounts/123/containers/C1/workspaces/1",
            name: "ws-1",
            description: "a",
            fingerprint: "1",
            tagManagerUrl: "",
          },
        });
      }).pipe(Effect.provide(withProvider(state))),
    );
    expect(result).toEqual({ action: "replace" });
  });
});

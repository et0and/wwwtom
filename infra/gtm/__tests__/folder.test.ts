import { describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Unowned } from "alchemy/AdoptPolicy";
import { Folder, FolderProvider, type FolderProps } from "../folder.ts";
import { makeFakeState } from "../fake.ts";
import { findGtmProvider, makeTestLayer, testSession } from "./driver.ts";

const withFolderProvider = (state: ReturnType<typeof makeFakeState>) =>
  Layer.provideMerge(FolderProvider(), makeTestLayer(state));

const reconcileFolder = async (
  state: ReturnType<typeof makeFakeState>,
  props: FolderProps,
  id = "my-folder",
): Promise<unknown> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const provider = yield* findGtmProvider(Folder);
      return yield* provider.reconcile({
        id,
        fqn: `Gtm.Folder/${id}`,
        instanceId: "test-instance",
        news: props,
        olds: undefined,
        output: undefined,
        session: testSession,
        bindings: [],
      });
    }).pipe(Effect.provide(withFolderProvider(state))),
  );

describe("Folder provider", () => {
  it("creates folder", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    const attrs = (await reconcileFolder(state, { workspacePath: ws, name: "my-folder" })) as {
      folderId: string;
      path: string;
    };
    expect(attrs.folderId).toBeDefined();
    expect(attrs.path).toContain(ws);
    expect(state.calls.some((c) => c.method === "POST" && c.path === `${ws}/folders`)).toBe(true);
  });

  it("updates with fingerprint", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    const created = (await reconcileFolder(state, { workspacePath: ws, name: "my-folder" })) as {
      fingerprint: string;
    };
    state.calls.length = 0;
    await new Promise((r) => setTimeout(r, 2));
    const updated = (await reconcileFolder(
      state,
      { workspacePath: ws, name: "my-folder", notes: "hello" },
      "my-folder",
    )) as { notes: string; fingerprint: string };
    expect(updated.notes).toBe("hello");
    expect(state.calls.some((c) => c.method === "PUT")).toBe(true);
    expect(updated.fingerprint).not.toBe(created.fingerprint);
  });

  it("read marks foreign folder as Unowned", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    state.folders.set(`${ws}/folders/1`, {
      path: `${ws}/folders/1`,
      accountId: "123",
      containerId: "C1",
      workspaceId: "1",
      folderId: "1",
      name: "my-folder",
      fingerprint: "1",
      tagManagerUrl: "https://tagmanager.google.com/",
      notes: "foreign",
    });
    const result: unknown = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findGtmProvider(Folder);
        return yield* provider.read({
          id: "my-folder",
          fqn: "Gtm.Folder/my-folder",
          instanceId: "test-instance",
          olds: { workspacePath: ws, name: "my-folder" },
          output: undefined,
        });
      }).pipe(Effect.provide(withFolderProvider(state))),
    );
    expect(Unowned.is(result)).toBe(true);
  });

  it("delete removes folder", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    const created = (await reconcileFolder(state, { workspacePath: ws, name: "my-folder" })) as {
      path: string;
    };
    await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findGtmProvider(Folder);
        yield* provider.delete({
          id: "my-folder",
          fqn: "Gtm.Folder/my-folder",
          instanceId: "test-instance",
          olds: { workspacePath: ws, name: "my-folder" },
          output: {
            accountId: "123",
            containerId: "C1",
            workspaceId: "1",
            folderId: "1",
            path: created.path,
            name: "my-folder",
            notes: "",
            fingerprint: "1",
            tagManagerUrl: "",
          },
          session: testSession,
          bindings: [],
        });
      }).pipe(Effect.provide(withFolderProvider(state))),
    );
    expect(state.folders.has(created.path)).toBe(false);
  });
});

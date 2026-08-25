import { describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Version, VersionProvider, type VersionProps } from "../version.ts";
import { Tag, TagProvider, type TagProps } from "../tag.ts";
import { makeFakeState } from "../fake.ts";
import { findGtmProvider, makeTestLayer, testSession } from "./driver.ts";

const withVersionProvider = (state: ReturnType<typeof makeFakeState>) =>
  Layer.provideMerge(VersionProvider(), makeTestLayer(state));

const withTagProvider = (state: ReturnType<typeof makeFakeState>) =>
  Layer.provideMerge(TagProvider(), makeTestLayer(state));

const reconcileVersion = async (
  state: ReturnType<typeof makeFakeState>,
  props: VersionProps,
  id = "my-version",
): Promise<unknown> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const provider = yield* findGtmProvider(Version);
      return yield* provider.reconcile({
        id,
        fqn: `Gtm.Version/${id}`,
        instanceId: "test-instance",
        news: props,
        olds: undefined,
        output: undefined,
        session: testSession,
        bindings: [],
      });
    }).pipe(Effect.provide(withVersionProvider(state))),
  );

const reconcileTag = async (
  state: ReturnType<typeof makeFakeState>,
  props: TagProps,
  id = "my-tag",
): Promise<unknown> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const provider = yield* findGtmProvider(Tag);
      return yield* provider.reconcile({
        id,
        fqn: `Gtm.Tag/${id}`,
        instanceId: "test-instance",
        news: props,
        olds: undefined,
        output: undefined,
        session: testSession,
        bindings: [],
      });
    }).pipe(Effect.provide(withTagProvider(state))),
  );

describe("Version provider", () => {
  it("creates version when workspace has changes and publishes when requested", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    // make workspace dirty
    await reconcileTag(state, { workspacePath: ws, name: "t1", type: "html" });
    const before = state.calls.filter((c) => c.path.includes(":create_version")).length;
    const attrs = (await reconcileVersion(state, {
      workspacePath: ws,
      name: "v1",
      notes: "first",
      publish: true,
    })) as {
      path: string;
      containerVersionId: string;
    };
    expect(attrs.containerVersionId).toBeDefined();
    expect(attrs.path).toContain("accounts/123/containers/C1/versions/");
    expect(state.calls.filter((c) => c.path.includes(":create_version")).length).toBe(before + 1);
    expect(state.calls.some((c) => c.path.includes(":publish"))).toBe(true);
    const containerPath = "accounts/123/containers/C1";
    expect(state.liveVersions.get(containerPath)).toBe(attrs.path);
  });

  it("no-op when workspace unchanged (idempotent)", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    await reconcileTag(state, { workspacePath: ws, name: "t1", type: "html" });
    const v1 = (await reconcileVersion(state, {
      workspacePath: ws,
      name: "v1",
      publish: false,
    })) as {
      containerVersionId: string;
    };
    const callsAfterFirst = state.calls.filter((c) => c.path.includes(":create_version")).length;
    // second reconcile without new changes should not create
    const v2 = (await reconcileVersion(state, {
      workspacePath: ws,
      name: "v1",
      publish: false,
    })) as {
      containerVersionId: string;
    };
    expect(v2.containerVersionId).toBe(v1.containerVersionId);
    expect(state.calls.filter((c) => c.path.includes(":create_version")).length).toBe(
      callsAfterFirst,
    );
  });

  it("publish false snapshots without publishing", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    await reconcileTag(state, { workspacePath: ws, name: "t1", type: "html" });
    await reconcileVersion(state, { workspacePath: ws, name: "v1", publish: false });
    expect(state.calls.some((c) => c.path.includes(":publish"))).toBe(false);
  });

  it("creates new version after further workspace change", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    await reconcileTag(state, { workspacePath: ws, name: "t1", type: "html" });
    const v1 = (await reconcileVersion(state, { workspacePath: ws, name: "v1" })) as {
      containerVersionId: string;
    };
    await reconcileTag(state, { workspacePath: ws, name: "t2", type: "html" });
    const v2 = (await reconcileVersion(state, { workspacePath: ws, name: "v2" })) as {
      containerVersionId: string;
    };
    expect(v2.containerVersionId).not.toBe(v1.containerVersionId);
  });
});

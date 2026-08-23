import { describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Unowned } from "alchemy/AdoptPolicy";
import { Tag, TagProvider, type TagProps } from "../tag.ts";
import { Trigger, TriggerProvider, type TriggerProps } from "../trigger.ts";
import { makeFakeState } from "../http.ts";
import { findGtmProvider, makeTestLayer, testSession } from "./driver.ts";

const withTagProvider = (state: ReturnType<typeof makeFakeState>) =>
  Layer.provideMerge(TagProvider(), makeTestLayer(state));

const withTriggerProvider = (state: ReturnType<typeof makeFakeState>) =>
  Layer.provideMerge(TriggerProvider(), makeTestLayer(state));

const reconcileTrigger = async (
  state: ReturnType<typeof makeFakeState>,
  props: TriggerProps,
  id = "my-trigger",
): Promise<unknown> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const provider = yield* findGtmProvider(Trigger);
      return yield* provider.reconcile({
        id,
        fqn: `Gtm.Trigger/${id}`,
        instanceId: "test-instance",
        news: props,
        olds: undefined,
        output: undefined,
        session: testSession,
        bindings: [],
      });
    }).pipe(Effect.provide(withTriggerProvider(state))),
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

describe("Trigger provider", () => {
  it("creates customEvent trigger", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    const attrs = (await reconcileTrigger(state, {
      workspacePath: ws,
      name: "evt",
      type: "customEvent",
      parameter: [{ type: "template", key: "eventName", value: "my_event" }],
    })) as { triggerId: string; path: string; name: string };
    expect(attrs.triggerId).toBeDefined();
    expect(attrs.path).toContain(ws);
    expect(state.calls.some((c) => c.method === "POST" && c.path === `${ws}/triggers`)).toBe(true);
  });

  it("updates with fingerprint", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    const created = (await reconcileTrigger(state, {
      workspacePath: ws,
      name: "evt",
      type: "customEvent",
    })) as { fingerprint: string };
    state.calls.length = 0;
    await new Promise((r) => setTimeout(r, 2));
    const updated = (await reconcileTrigger(
      state,
      {
        workspacePath: ws,
        name: "evt",
        type: "customEvent",
        notes: "hello",
      },
      "my-trigger",
    )) as { notes: string; fingerprint: string };
    expect(updated.notes).toBe("hello");
    expect(state.calls.some((c) => c.method === "PUT")).toBe(true);
    expect(updated.fingerprint).not.toBe(created.fingerprint);
  });

  it("read marks foreign trigger as Unowned", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    state.triggers.set(`${ws}/triggers/1`, {
      path: `${ws}/triggers/1`,
      accountId: "123",
      containerId: "C1",
      workspaceId: "1",
      triggerId: "1",
      name: "evt",
      type: "customEvent",
      fingerprint: "1",
      tagManagerUrl: "https://tagmanager.google.com/",
      notes: "foreign",
    });
    const result: unknown = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findGtmProvider(Trigger);
        return yield* provider.read({
          id: "evt",
          fqn: "Gtm.Trigger/evt",
          instanceId: "test-instance",
          olds: { workspacePath: ws, name: "evt", type: "customEvent" },
          output: undefined,
        });
      }).pipe(Effect.provide(withTriggerProvider(state))),
    );
    expect(Unowned.is(result)).toBe(true);
  });

  it("delete removes trigger", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    const created = (await reconcileTrigger(state, {
      workspacePath: ws,
      name: "evt",
      type: "customEvent",
    })) as { path: string };
    await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findGtmProvider(Trigger);
        yield* provider.delete({
          id: "evt",
          fqn: "Gtm.Trigger/evt",
          instanceId: "test-instance",
          olds: { workspacePath: ws, name: "evt", type: "customEvent" },
          output: {
            accountId: "123",
            containerId: "C1",
            workspaceId: "1",
            triggerId: "1",
            path: created.path,
            name: "evt",
            type: "customEvent",
            notes: "",
            fingerprint: "1",
            tagManagerUrl: "",
          },
          session: testSession,
          bindings: [],
        });
      }).pipe(Effect.provide(withTriggerProvider(state))),
    );
    expect(state.triggers.has(created.path)).toBe(false);
  });
});

describe("Tag provider", () => {
  it("creates tag wired to trigger via firingTriggerId", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    const trig = (await reconcileTrigger(
      state,
      {
        workspacePath: ws,
        name: "evt",
        type: "customEvent",
      },
      "evt",
    )) as { triggerId: string };

    const tag = (await reconcileTag(state, {
      workspacePath: ws,
      name: "my-tag",
      type: "html",
      parameter: [{ type: "template", key: "html", value: "<b>hi</b>" }],
      firingTriggerId: [trig.triggerId],
    })) as { firingTriggerId: string[] };
    expect(tag.firingTriggerId).toEqual([trig.triggerId]);
  });

  it("setup/teardown wiring via tagName", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    await reconcileTag(state, { workspacePath: ws, name: "setup-tag", type: "html" }, "setup-tag");
    const main = (await reconcileTag(state, {
      workspacePath: ws,
      name: "main-tag",
      type: "html",
      setupTag: [{ tagName: "setup-tag" }],
      teardownTag: [{ tagName: "setup-tag" }],
    })) as { setupTag: { tagName: string }[] };
    expect(main.setupTag?.[0]?.tagName).toBe("setup-tag");
  });

  it("updates with fingerprint and preserves wiring", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    const trig = (await reconcileTrigger(state, {
      workspacePath: ws,
      name: "evt",
      type: "customEvent",
    })) as { triggerId: string };
    const created = (await reconcileTag(state, {
      workspacePath: ws,
      name: "my-tag",
      type: "html",
      firingTriggerId: [trig.triggerId],
    })) as { fingerprint: string };
    state.calls.length = 0;
    await new Promise((r) => setTimeout(r, 2));
    const updated = (await reconcileTag(state, {
      workspacePath: ws,
      name: "my-tag",
      type: "html",
      firingTriggerId: [trig.triggerId],
      notes: "updated",
    })) as { notes: string; fingerprint: string };
    expect(updated.notes).toBe("updated");
    expect(state.calls.some((c) => c.method === "PUT")).toBe(true);
    expect(updated.fingerprint).not.toBe(created.fingerprint);
  });

  it("read marks foreign tag as Unowned", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    state.tags.set(`${ws}/tags/1`, {
      path: `${ws}/tags/1`,
      accountId: "123",
      containerId: "C1",
      workspaceId: "1",
      tagId: "1",
      name: "my-tag",
      type: "html",
      fingerprint: "1",
      tagManagerUrl: "https://tagmanager.google.com/",
      notes: "foreign",
    });
    const result: unknown = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findGtmProvider(Tag);
        return yield* provider.read({
          id: "my-tag",
          fqn: "Gtm.Tag/my-tag",
          instanceId: "test-instance",
          olds: { workspacePath: ws, name: "my-tag", type: "html" },
          output: undefined,
        });
      }).pipe(Effect.provide(withTagProvider(state))),
    );
    expect(Unowned.is(result)).toBe(true);
  });

  it("delete removes tag", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    const created = (await reconcileTag(state, {
      workspacePath: ws,
      name: "my-tag",
      type: "html",
    })) as { path: string };
    await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findGtmProvider(Tag);
        yield* provider.delete({
          id: "my-tag",
          fqn: "Gtm.Tag/my-tag",
          instanceId: "test-instance",
          olds: { workspacePath: ws, name: "my-tag", type: "html" },
          output: {
            accountId: "123",
            containerId: "C1",
            workspaceId: "1",
            tagId: "1",
            path: created.path,
            name: "my-tag",
            type: "html",
            notes: "",
            fingerprint: "1",
            tagManagerUrl: "",
          },
          session: testSession,
          bindings: [],
        });
      }).pipe(Effect.provide(withTagProvider(state))),
    );
    expect(state.tags.has(created.path)).toBe(false);
  });

  it("customEvent trigger + tag integration", async () => {
    const state = makeFakeState();
    const ws = "accounts/123/containers/C1/workspaces/1";
    const trig = (await reconcileTrigger(
      state,
      {
        workspacePath: ws,
        name: "my_custom_event",
        type: "customEvent",
        parameter: [{ type: "template", key: "eventName", value: "my_event" }],
        customEventFilter: [
          {
            type: "equals",
            parameter: [
              { type: "template", key: "arg0", value: "{{_event}}" },
              { type: "template", key: "arg1", value: "my_event" },
            ],
          },
        ],
      },
      "evt",
    )) as { triggerId: string; customEventFilter: unknown };

    expect(trig.customEventFilter).toBeDefined();

    const tag = (await reconcileTag(state, {
      workspacePath: ws,
      name: "my-tag",
      type: "html",
      parameter: [{ type: "template", key: "html", value: "<script>hi</script>" }],
      firingTriggerId: [trig.triggerId],
    })) as { firingTriggerId: string[] };
    expect(tag.firingTriggerId?.[0]).toBe(trig.triggerId);
  });
});

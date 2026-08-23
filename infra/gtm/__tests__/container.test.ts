import { describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Unowned } from "alchemy/AdoptPolicy";
import {
  Container,
  ContainerProvider,
  type ContainerAttributes,
  type ContainerProps,
} from "../container.ts";
import { makeFakeState } from "../http.ts";
import { findGtmProvider, makeTestLayer, testSession } from "./driver.ts";

const withProvider = (state: ReturnType<typeof makeFakeState>) =>
  Layer.provideMerge(ContainerProvider(), makeTestLayer(state));

const reconcile = async (
  state: ReturnType<typeof makeFakeState>,
  props: ContainerProps,
  id = "my-container",
): Promise<unknown> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const provider = yield* findGtmProvider(Container);
      return yield* provider.reconcile({
        id,
        fqn: `Gtm.Container/${id}`,
        instanceId: "test-instance",
        news: props,
        olds: undefined,
        output: undefined,
        session: testSession,
        bindings: [],
      });
    }).pipe(Effect.provide(withProvider(state))),
  );

const diff = async (
  state: ReturnType<typeof makeFakeState>,
  olds: ContainerProps,
  news: ContainerProps,
  output: ContainerAttributes | undefined,
): Promise<unknown> =>
  Effect.runPromise(
    Effect.gen(function* () {
      const provider = yield* findGtmProvider(Container);
      return yield* provider.diff({
        id: "my-container",
        fqn: "Gtm.Container/my-container",
        instanceId: "test-instance",
        olds,
        news,
        oldBindings: [],
        newBindings: [],
        output: output as never,
      });
    }).pipe(Effect.provide(withProvider(state))),
  );

describe("Container provider", () => {
  it("creates when absent", async () => {
    const state = makeFakeState();
    const attrs = (await reconcile(state, {
      accountPath: "accounts/123",
      name: "my-container",
    })) as { path: string; name: string };
    expect(attrs.path).toContain("accounts/123/containers/");
    expect(attrs.name).toBe("my-container");
    expect(state.calls.some((c) => c.method === "POST")).toBe(true);
  });

  it("updates with fingerprint when present", async () => {
    const state = makeFakeState();
    const created = (await reconcile(state, {
      accountPath: "accounts/123",
      name: "my-container",
      notes: "hello",
    })) as { path: string; fingerprint: string };
    const beforeFingerprint = created.fingerprint;
    state.calls.length = 0;
    await new Promise((r) => setTimeout(r, 2));
    const updated = (await reconcile(state, {
      accountPath: "accounts/123",
      name: "my-container",
      notes: "hello world",
    })) as { notes: string; fingerprint: string };
    expect(updated.notes).toBe("hello world");
    expect(state.calls.some((c) => c.method === "PUT" && c.path === created.path)).toBe(true);
    expect(updated.fingerprint).not.toBe(beforeFingerprint);
  });

  it("no-op when unchanged (idempotent)", async () => {
    const state = makeFakeState();
    await reconcile(state, { accountPath: "accounts/123", name: "my-container", notes: "hello" });
    state.calls.length = 0;
    await reconcile(state, { accountPath: "accounts/123", name: "my-container", notes: "hello" });
    const puts = state.calls.filter((c) => c.method === "PUT");
    expect(puts.length).toBe(0);
  });

  it("read marks foreign same-name container as Unowned", async () => {
    const state = makeFakeState();
    state.containers.set("accounts/123/containers/C999", {
      path: "accounts/123/containers/C999",
      accountId: "123",
      containerId: "C999",
      name: "my-container",
      publicId: "GTM-C999",
      fingerprint: "1",
      tagManagerUrl: "https://tagmanager.google.com/",
      notes: "foreign notes without marker",
    });

    const result: unknown = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findGtmProvider(Container);
        return yield* provider.read({
          id: "my-container",
          fqn: "Gtm.Container/my-container",
          instanceId: "test-instance",
          olds: { accountPath: "accounts/123", name: "my-container" },
          output: undefined,
        });
      }).pipe(Effect.provide(withProvider(state))),
    );

    expect(Unowned.is(result)).toBe(true);
  });

  it("delete removes container", async () => {
    const state = makeFakeState();
    const created = (await reconcile(state, {
      accountPath: "accounts/123",
      name: "my-container",
    })) as { path: string };
    expect(state.containers.has(created.path)).toBe(true);

    await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findGtmProvider(Container);
        yield* provider.delete({
          id: "my-container",
          fqn: "Gtm.Container/my-container",
          instanceId: "test-instance",
          olds: { accountPath: "accounts/123", name: "my-container" },
          output: {
            accountId: "123",
            containerId: "C1",
            path: created.path,
            publicId: "GTM-C1",
            name: "my-container",
            notes: "",
            fingerprint: "1",
            tagManagerUrl: "",
          },
          session: testSession,
          bindings: [],
        });
      }).pipe(Effect.provide(withProvider(state))),
    );

    expect(state.containers.has(created.path)).toBe(false);
  });

  it("diff flags replace on accountPath change", async () => {
    const state = makeFakeState();
    const out = {
      accountId: "123",
      containerId: "C1",
      path: "accounts/123/containers/C1",
      publicId: "GTM-C1",
      name: "my-container",
      notes: "",
      fingerprint: "1",
      tagManagerUrl: "",
    };
    const result = await diff(
      state,
      { accountPath: "accounts/123", name: "my-container" },
      { accountPath: "accounts/999", name: "my-container" },
      out,
    );
    expect(result).toEqual({ action: "replace" });
  });
});

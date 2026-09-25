import { describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Group, GroupProvider } from "../group.ts";
import type { GroupProps } from "../group.ts";
import { makeFakeState } from "../fake.ts";
import type { FakeState } from "../fake.ts";
import { findTursoProvider, makeTestLayer, testSession } from "./driver.ts";

const withProvider = (state: FakeState) =>
  Layer.provideMerge(GroupProvider(), makeTestLayer(state));

const reconcile = (state: FakeState, news: GroupProps) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const provider = yield* findTursoProvider(Group);
      return yield* provider.reconcile({
        id: "default",
        fqn: "Turso.Group/default",
        instanceId: "test-instance",
        news,
        olds: undefined,
        output: undefined,
        session: testSession,
        bindings: [],
      });
    }).pipe(Effect.provide(withProvider(state))),
  );

describe("Group provider", () => {
  it("creates a group at the declared location", async () => {
    const state = makeFakeState();

    const attrs = await reconcile(state, {
      name: "default",
      location: "aws-eu-west-1",
    });

    expect(attrs).toMatchObject({ name: "default", primary: "aws-eu-west-1" });
    expect(state.groups.get("default")).toBeDefined();
  });

  it("refuses to create a group with no location", async () => {
    const state = makeFakeState();

    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findTursoProvider(Group);
        return yield* provider
          .reconcile({
            id: "default",
            fqn: "Turso.Group/default",
            instanceId: "test-instance",
            news: { name: "default" },
            olds: undefined,
            output: undefined,
            session: testSession,
            bindings: [],
          })
          .pipe(Effect.flip);
      }).pipe(Effect.provide(withProvider(state))),
    );

    expect(error).toMatchObject({ _tag: "InvalidArgument" });
    expect(state.groups.size).toBe(0);
  });

  it("adopts an existing group without re-creating it", async () => {
    const state = makeFakeState();
    state.groups.set("default", {
      name: "default",
      uuid: "group-uuid",
      primary: "aws-eu-west-1",
      delete_protection: false,
      locations: ["aws-eu-west-1"],
    });

    const attrs = await reconcile(state, { name: "default", location: "aws-eu-west-1" });

    expect(attrs).toMatchObject({ name: "default", uuid: "group-uuid" });
  });

  it("refuses to adopt a group that sits in another location", async () => {
    const state = makeFakeState();
    state.groups.set("default", {
      name: "default",
      uuid: "group-uuid",
      primary: "aws-us-east-1",
      delete_protection: false,
      locations: ["aws-us-east-1"],
    });

    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findTursoProvider(Group);
        return yield* provider
          .reconcile({
            id: "default",
            fqn: "Turso.Group/default",
            instanceId: "test-instance",
            news: { name: "default", location: "aws-eu-west-1" },
            olds: { name: "default", location: "aws-us-east-1" },
            output: undefined,
            session: testSession,
            bindings: [],
          })
          .pipe(Effect.flip);
      }).pipe(Effect.provide(withProvider(state))),
    );

    expect(error).toMatchObject({ _tag: "InvalidArgument" });
  });

  it("turns delete protection on through the configuration patch", async () => {
    const state = makeFakeState();
    await reconcile(state, { name: "default", location: "aws-eu-west-1" });

    const attrs = await reconcile(state, {
      name: "default",
      location: "aws-eu-west-1",
      deleteProtection: true,
    });

    expect(attrs).toMatchObject({ deleteProtection: true });
    expect(state.calls).toContainEqual({
      method: "PATCH",
      path: "/groups/default/configuration",
    });
  });

  it("leaves the group alone when nothing drifted", async () => {
    const state = makeFakeState();
    await reconcile(state, { name: "default", location: "aws-eu-west-1" });
    const before = state.calls.length;

    await reconcile(state, { name: "default", location: "aws-eu-west-1" });

    // Reads only: the group and its applied configuration. No PATCH.
    expect(state.calls.slice(before)).toEqual([
      { method: "GET", path: "/groups" },
      { method: "GET", path: "/groups/default/configuration" },
    ]);
  });

  it("adopts an existing group when the stack declares no location", async () => {
    const state = makeFakeState();
    await reconcile(state, { name: "default", location: "aws-eu-west-1" });
    const before = state.calls.length;

    // `location` is only a create input, so omitting it must not be drift.
    const attrs = await reconcile(state, { name: "default" });

    expect(attrs).toMatchObject({ name: "default", primary: "aws-eu-west-1" });
    expect(state.calls.slice(before).some((call) => call.method === "PATCH")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Location, LocationProvider } from "../location.ts";
import { makeFakeState } from "../fake.ts";
import type { FakeState } from "../fake.ts";
import { findTursoProvider, makeTestLayer, testSession } from "./driver.ts";

const withProvider = (state: FakeState) =>
  Layer.provideMerge(LocationProvider(), makeTestLayer(state));

describe("Location provider", () => {
  it("resolves a catalog code to its human-readable name", async () => {
    const state = makeFakeState();

    const attrs = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findTursoProvider(Location);
        return yield* provider.reconcile({
          id: "primary",
          fqn: "Turso.Location/primary",
          instanceId: "test-instance",
          news: { code: "aws-eu-west-1" },
          olds: undefined,
          output: undefined,
          session: testSession,
          bindings: [],
        });
      }).pipe(Effect.provide(withProvider(state))),
    );

    expect(attrs).toEqual({ code: "aws-eu-west-1", name: "AWS EU West (Ireland)" });
  });

  it("refuses a code that Turso does not list", async () => {
    const state = makeFakeState();

    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findTursoProvider(Location);
        return yield* provider
          .reconcile({
            id: "primary",
            fqn: "Turso.Location/primary",
            instanceId: "test-instance",
            news: { code: "aws-mars-1" },
            olds: undefined,
            output: undefined,
            session: testSession,
            bindings: [],
          })
          .pipe(Effect.flip);
      }).pipe(Effect.provide(withProvider(state))),
    );

    expect(error).toMatchObject({ _tag: "InvalidArgument" });
  });

  it("reports an unknown code as absent on read", async () => {
    const state = makeFakeState();

    const attrs = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findTursoProvider(Location);
        return yield* provider.read({
          id: "primary",
          fqn: "Turso.Location/primary",
          instanceId: "test-instance",
          olds: { code: "aws-mars-1" },
          output: undefined,
        });
      }).pipe(Effect.provide(withProvider(state))),
    );

    expect(attrs).toBeUndefined();
  });
});

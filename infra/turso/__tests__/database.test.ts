import { describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Database, DatabaseProvider } from "../database.ts";
import type { DatabaseProps } from "../database.ts";
import { makeFakeState } from "../fake.ts";
import type { FakeState } from "../fake.ts";
import { findTursoProvider, makeTestLayer, seedGroup, testSession } from "./driver.ts";

const withProvider = (state: FakeState) =>
  Layer.provideMerge(DatabaseProvider(), makeTestLayer(state));

const reconcile = (state: FakeState, news: DatabaseProps) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const provider = yield* findTursoProvider(Database);
      return yield* provider.reconcile({
        id: "wwwtom",
        fqn: "Turso.Database/wwwtom",
        instanceId: "test-instance",
        news,
        olds: undefined,
        output: undefined,
        session: testSession,
        bindings: [],
      });
    }).pipe(Effect.provide(withProvider(state))),
  );

describe("Database provider", () => {
  it("creates a database in an existing group and reports its hostname", async () => {
    const state = makeFakeState();
    seedGroup(state);

    const attrs = await reconcile(state, { name: "wwwtom", group: "default" });

    expect(attrs).toMatchObject({
      name: "wwwtom",
      group: "default",
      hostname: "wwwtom-wwwtom.turso.io",
    });
  });

  it("adopts an existing database instead of creating a second one", async () => {
    const state = makeFakeState();
    seedGroup(state);
    await reconcile(state, { name: "wwwtom", group: "default" });

    const attrs = await reconcile(state, { name: "wwwtom", group: "default" });

    expect(attrs).toMatchObject({ name: "wwwtom" });
    expect(state.databases.size).toBe(1);
  });

  it("applies a declared size limit through the configuration patch", async () => {
    const state = makeFakeState();
    seedGroup(state);

    const attrs = await reconcile(state, {
      name: "wwwtom",
      group: "default",
      sizeLimit: "1gb",
    });

    expect(state.calls).toContainEqual({
      method: "PATCH",
      path: "/databases/wwwtom/configuration",
    });
    // The applied limit is read back from Turso, not assumed.
    expect(attrs).toMatchObject({ sizeLimit: "1gb" });
  });

  it("does not re-patch a converged database", async () => {
    const state = makeFakeState();
    seedGroup(state);
    await reconcile(state, { name: "wwwtom", group: "default", sizeLimit: "1gb" });
    const before = state.calls.length;

    await reconcile(state, { name: "wwwtom", group: "default", sizeLimit: "1gb" });

    // `GET .../configuration` reports the applied value, so a second deploy is
    // read-only.
    expect(state.calls.slice(before).some((call) => call.method === "PATCH")).toBe(false);
  });

  it("re-patches when the observed configuration drifted", async () => {
    const state = makeFakeState();
    seedGroup(state);
    await reconcile(state, { name: "wwwtom", group: "default", sizeLimit: "1gb" });
    state.databases.set("wwwtom", { ...state.databases.get("wwwtom")!, size_limit: "256mb" });
    const before = state.calls.length;

    await reconcile(state, { name: "wwwtom", group: "default", sizeLimit: "1gb" });

    expect(state.calls.slice(before)).toContainEqual({
      method: "PATCH",
      path: "/databases/wwwtom/configuration",
    });
  });

  it("clears allowed IPs when the stack declares an empty list", async () => {
    const state = makeFakeState();
    seedGroup(state);
    await reconcile(state, { name: "wwwtom", group: "default", allowedIps: ["10.0.0.1"] });

    const attrs = await reconcile(state, { name: "wwwtom", group: "default", allowedIps: [] });

    expect(attrs).toMatchObject({ allowedIps: [] });
  });

  it("refuses to move an existing database to another group", async () => {
    const state = makeFakeState();
    seedGroup(state, "default");
    seedGroup(state, "other");
    await reconcile(state, { name: "wwwtom", group: "default" });

    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findTursoProvider(Database);
        return yield* provider
          .reconcile({
            id: "wwwtom",
            fqn: "Turso.Database/wwwtom",
            instanceId: "test-instance",
            news: { name: "wwwtom", group: "other" },
            olds: { name: "wwwtom", group: "default" },
            output: undefined,
            session: testSession,
            bindings: [],
          })
          .pipe(Effect.flip);
      }).pipe(Effect.provide(withProvider(state))),
    );

    expect(error).toMatchObject({ _tag: "InvalidArgument" });
  });

  it("deletes the database and tolerates a missing one", async () => {
    const state = makeFakeState();
    seedGroup(state);
    await reconcile(state, { name: "wwwtom", group: "default" });

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findTursoProvider(Database);
        const request = {
          id: "wwwtom",
          fqn: "Turso.Database/wwwtom",
          instanceId: "test-instance",
          olds: { name: "wwwtom", group: "default" },
          output: {
            name: "wwwtom",
            dbId: "db-1",
            hostname: "wwwtom-wwwtom.turso.io",
            group: "default",
            primaryRegion: "aws-eu-west-1",
            deleteProtection: false,
            blockReads: false,
            blockWrites: false,
            allowedIps: [],
          },
          session: testSession,
          bindings: [],
        };
        yield* provider.delete(request);
        return yield* provider.delete(request);
      }).pipe(Effect.provide(withProvider(state))),
    );

    expect(result).toBeUndefined();
    expect(state.databases.size).toBe(0);
  });
});

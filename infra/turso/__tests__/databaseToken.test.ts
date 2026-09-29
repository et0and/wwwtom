import { describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Layer from "effect/Layer";
import { DatabaseToken, DatabaseTokenProvider } from "../databaseToken.ts";
import type { DatabaseTokenAttributes, DatabaseTokenProps } from "../databaseToken.ts";
import { makeFakeState } from "../fake.ts";
import type { FakeState } from "../fake.ts";
import { findTursoProvider, makeTestLayer, seedGroup, testSession } from "./driver.ts";

const withProvider = (state: FakeState) =>
  Layer.provideMerge(DatabaseTokenProvider(), makeTestLayer(state));

const reconcile = (state: FakeState, news: DatabaseTokenProps) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const provider = yield* findTursoProvider(DatabaseToken);
      return yield* provider.reconcile({
        id: "wwwtom",
        fqn: "Turso.DatabaseToken/wwwtom",
        instanceId: "test-instance",
        news,
        olds: undefined,
        output: undefined,
        session: testSession,
        bindings: [],
      });
    }).pipe(Effect.provide(withProvider(state))),
  );

const MS_PER_DAY = 86_400_000;

/** Dates are relative to now so the fixtures never lapse mid-run. */
const attributesOf = (jwt: Redacted.Redacted, offsetDays?: number) => ({
  database: "wwwtom",
  jwt,
  authorization: "full-access" as const,
  issuedAt: new Date(Date.now() - MS_PER_DAY).toISOString(),
  ...(offsetDays !== undefined
    ? { expiresAt: new Date(Date.now() + offsetDays * MS_PER_DAY).toISOString() }
    : undefined),
});

const diff = (
  state: FakeState,
  olds: DatabaseTokenProps,
  news: DatabaseTokenProps,
  output?: DatabaseTokenAttributes,
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const provider = yield* findTursoProvider(DatabaseToken);
      return yield* provider.diff({
        id: "wwwtom",
        fqn: "Turso.DatabaseToken/wwwtom",
        instanceId: "test-instance",
        news,
        olds,
        output,
        oldBindings: [],
        newBindings: [],
      });
    }).pipe(Effect.provide(withProvider(state))),
  );

describe("DatabaseToken provider", () => {
  it("mints a scoped token and keeps the JWT out of plain text", async () => {
    const state = makeFakeState();
    seedGroup(state);
    state.databases.set("wwwtom", {
      Name: "wwwtom",
      DbId: "db-1",
      Hostname: "wwwtom-wwwtom.turso.io",
      group: "default",
      primaryRegion: "aws-eu-west-1",
      block_reads: false,
      block_writes: false,
      delete_protection: false,
    });

    const attrs = await reconcile(state, { database: "wwwtom", expiresInDays: 90 });

    expect(attrs).toMatchObject({ database: "wwwtom", authorization: "full-access" });
    expect(Redacted.isRedacted(attrs.jwt)).toBe(true);
    expect(state.mintedTokens).toHaveLength(1);
  });

  it("keeps the existing token when nothing drifted", async () => {
    const state = makeFakeState();
    const action = await diff(
      state,
      { database: "wwwtom", expiresInDays: 90 },
      { database: "wwwtom", expiresInDays: 90 },
      attributesOf(Redacted.make("jwt.1"), 90),
    );

    expect(action).toBeUndefined();
  });

  it("replaces the token once its lifetime has lapsed", async () => {
    const state = makeFakeState();

    const action = await diff(
      state,
      { database: "wwwtom", expiresInDays: 90 },
      { database: "wwwtom", expiresInDays: 90 },
      attributesOf(Redacted.make("jwt.1"), -1),
    );

    expect(action).toEqual({ action: "replace" });
  });

  it("replaces the token when the authorization changes", async () => {
    const state = makeFakeState();

    const action = await diff(
      state,
      { database: "wwwtom", authorization: "full-access" },
      { database: "wwwtom", authorization: "read-only" },
    );

    expect(action).toEqual({ action: "replace" });
  });

  it("never re-mints on read, because Turso cannot return a token", async () => {
    const state = makeFakeState();
    const output = attributesOf(Redacted.make("jwt.1"), 90);

    const attrs = await Effect.runPromise(
      Effect.gen(function* () {
        const provider = yield* findTursoProvider(DatabaseToken);
        return yield* provider.read({
          id: "wwwtom",
          fqn: "Turso.DatabaseToken/wwwtom",
          instanceId: "test-instance",
          olds: { database: "wwwtom", expiresInDays: 90 },
          output,
        });
      }).pipe(Effect.provide(withProvider(state))),
    );

    expect(attrs).toEqual(output);
  });
});

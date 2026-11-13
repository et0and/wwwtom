import path from "node:path";
import { promises as fs } from "node:fs";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Effect, Layer } from "effect";
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "pglite-server";
import { FileMigrationProvider, Kysely, Migrator } from "kysely";
import { PostgresJSDialect } from "kysely-postgres-js";
import postgres from "postgres";
import {
  DatabaseService,
  closeDb,
  type DatabaseServiceContract,
  type GuestbookEntryParams,
  type GuestbookSessionParams,
  type OAuthSessionParams,
} from "../service";
import { makeAppConfigLayer } from "@tom/utils/config";
import type { Database } from "@tom/types/db";

/**
 * Integration tests against a real Postgres engine: pglite-server exposes an
 * in-process PGlite instance over the Postgres wire protocol, so the service's
 * own postgres.js connection path (and the migrations) run against actual SQL
 * semantics with no external database.
 */
describe("DatabaseService", () => {
  let pg: PGlite;
  let pgServer: ReturnType<typeof createServer>;
  let connectionString = "";
  let db: Kysely<Database>;

  // Booting an in-process Postgres engine and running the migrations can take
  // well over the default 10s hook timeout on a cold CI runner, so give the
  // one-time bootstrap an explicit generous budget.
  beforeAll(async () => {
    pg = new PGlite();
    await pg.waitReady;
    pgServer = createServer(pg);
    await new Promise<void>((resolve) => {
      pgServer.listen(0, resolve);
    });
    const address = pgServer.address();
    if (!address) {
      throw new Error("pglite-server did not report a listening address");
    }
    // A TCP server bound via listen(0) always reports an AddressInfo, never a
    // unix-socket path string.
    const port = (address as AddressInfo).port;
    connectionString = `postgres://postgres@localhost:${port}/postgres`;

    db = new Kysely<Database>({
      dialect: new PostgresJSDialect({ postgres: postgres(connectionString, { max: 1 }) }),
    });

    const migrator = new Migrator({
      db,
      provider: new FileMigrationProvider({
        fs,
        path,
        migrationFolder: path.join(import.meta.dirname, "../migrations"),
      }),
    });
    const result = await migrator.migrateToLatest();
    expect(result.error).toBeUndefined();
    expect(result.results?.map((migration) => migration.status)).toEqual(["Success", "Success"]);
  }, 60_000);

  afterAll(async () => {
    await db.destroy();
    await Effect.runPromise(closeDb(connectionString));
    await new Promise<void>((resolve) => {
      pgServer.close(() => resolve());
    });
    await pg.close();
  });

  beforeEach(async () => {
    await db.deleteFrom("oauth_sessions").execute();
    await db.deleteFrom("guestbook_sessions").execute();
    await db.deleteFrom("guestbook_entries").execute();
  });

  const run = <A, E>(use: (db: DatabaseServiceContract) => Effect.Effect<A, E>): Promise<A> =>
    Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* DatabaseService;
        return yield* use(service);
      }).pipe(
        Effect.provide(
          Layer.provide(
            DatabaseService.Default,
            makeAppConfigLayer({ DATABASE_URL: connectionString }),
          ),
        ),
      ),
    );

  const entryParams = (
    message: string,
    username = "tom@mastodon.social",
  ): GuestbookEntryParams => ({
    fediverse_username: username,
    fediverse_instance: "mastodon.social",
    display_name: "Tom",
    avatar_url: "https://mastodon.social/avatar.png",
    message,
  });

  const sessionParams = (sessionToken: string, expiresAt: Date): OAuthSessionParams => ({
    session_token: sessionToken,
    fediverse_instance: "mastodon.social",
    client_id: "client-id",
    client_secret: "client-secret",
    state: "state",
    code_verifier: null,
    expires_at: expiresAt,
  });

  const sessionParamsFor = (
    sessionToken: string,
    expiresAt: Date,
    username = "tom@mastodon.social",
  ): GuestbookSessionParams => ({
    session_token: sessionToken,
    fediverse_username: username,
    fediverse_instance: "mastodon.social",
    display_name: "Tom",
    avatar_url: "https://mastodon.social/avatar.png",
    expires_at: expiresAt,
  });

  const createEntry = (params: GuestbookEntryParams) => (db: DatabaseServiceContract) =>
    db.createGuestbookEntry(params);
  const listEntries = (page: number, pageSize: number) => (db: DatabaseServiceContract) =>
    db.getGuestbookEntries({ page, page_size: pageSize });
  const createGuestSession = (params: GuestbookSessionParams) => (db: DatabaseServiceContract) =>
    db.createGuestbookSession(params);
  const getGuestSession = (token: string) => (db: DatabaseServiceContract) =>
    db.getGuestbookSession(token);
  const deleteGuestSession = (token: string) => (db: DatabaseServiceContract) =>
    db.deleteGuestbookSession(token);
  const createSession = (params: OAuthSessionParams) => (db: DatabaseServiceContract) =>
    db.createOAuthSession(params);
  const getSession = (token: string) => (db: DatabaseServiceContract) => db.getOAuthSession(token);
  const deleteSession = (token: string) => (db: DatabaseServiceContract) =>
    db.deleteOAuthSession(token);
  const cleanupSessions = () => (db: DatabaseServiceContract) => db.cleanupExpiredSessions;

  describe("guestbook entries", () => {
    it("creates an entry and returns the row with generated id and timestamps", async () => {
      const entry = await run(createEntry(entryParams("hello")));

      expect(entry.id).toBeGreaterThan(0);
      expect(entry.message).toBe("hello");
      expect(entry.created_at).toBeInstanceOf(Date);
      expect(entry.updated_at).toBeInstanceOf(Date);
    });

    it("lists entries newest first with pagination and totals", async () => {
      await run(createEntry(entryParams("first", "one@mastodon.social")));
      await new Promise((resolve) => setTimeout(resolve, 2));
      await run(createEntry(entryParams("second", "two@mastodon.social")));
      await new Promise((resolve) => setTimeout(resolve, 2));
      await run(createEntry(entryParams("third", "three@mastodon.social")));

      const page1 = await run(listEntries(1, 2));
      expect(page1.total_count).toBe(3);
      expect(page1.page_size).toBe(2);
      expect(page1.results.map((entry) => entry.message)).toEqual(["third", "second"]);

      const page2 = await run(listEntries(2, 2));
      expect(page2.results.map((entry) => entry.message)).toEqual(["first"]);
    });

    it("rejects a second signature for the same identity with a conflict", async () => {
      await run(createEntry(entryParams("first")));

      // The run helper rejects on a typed failure, so fold the conflict into
      // a value before asserting on the tag.
      const outcome = await run((db) =>
        Effect.match(db.createGuestbookEntry(entryParams("second")), {
          onFailure: (error) => error,
          onSuccess: () => null,
        }),
      );
      expect(outcome).toMatchObject({
        _tag: "GuestbookConflictError",
        message: "You have already signed the guestbook",
      });

      const listed = await run(listEntries(1, 10));
      expect(listed.results.map((entry) => entry.message)).toEqual(["first"]);
    });

    it("enforces uniqueness at the database, not in a pre-read", async () => {
      await run(createEntry(entryParams("first")));

      const write = () =>
        db.insertInto("guestbook_entries").values({
          fediverse_username: "tom@mastodon.social",
          fediverse_instance: "mastodon.social",
          display_name: null,
          avatar_url: null,
          message: "direct",
        });

      await expect(write().execute()).rejects.toThrow(/duplicate key/);
    });
  });

  describe("guestbook sessions", () => {
    it("creates a session and reads it back by token", async () => {
      const created = await run(
        createGuestSession(sessionParamsFor("session-1", new Date(Date.now() + 60_000))),
      );

      expect(created.session_token).toBe("session-1");
      expect(created.fediverse_username).toBe("tom@mastodon.social");

      const fetched = await run(getGuestSession("session-1"));
      expect(fetched?.display_name).toBe("Tom");
      expect(fetched?.expires_at).toBeInstanceOf(Date);
    });

    it("treats expired and unknown tokens as signed out", async () => {
      await run(createGuestSession(sessionParamsFor("expired", new Date(Date.now() - 60_000))));

      expect(await run(getGuestSession("expired"))).toBeNull();
      expect(await run(getGuestSession("missing"))).toBeNull();
    });

    it("revokes a session by token", async () => {
      await run(createGuestSession(sessionParamsFor("session-1", new Date(Date.now() + 60_000))));

      expect(await run(deleteGuestSession("session-1"))).toBe(1);
      expect(await run(getGuestSession("session-1"))).toBeNull();
    });

    it("sweeps expired sessions when a new one is created", async () => {
      await run(createGuestSession(sessionParamsFor("stale", new Date(Date.now() - 60_000))));
      await run(createGuestSession(sessionParamsFor("fresh", new Date(Date.now() + 60_000))));

      const rows = await db.selectFrom("guestbook_sessions").select("session_token").execute();
      expect(rows.map((row) => row.session_token)).toEqual(["fresh"]);
    });
  });

  describe("oauth sessions", () => {
    it("creates a session and reads it back", async () => {
      const created = await run(
        createSession(sessionParams("token-1", new Date(Date.now() + 60_000))),
      );

      expect(created.id).toBeGreaterThan(0);
      expect(created.session_token).toBe("token-1");

      const fetched = await run(getSession("token-1"));
      expect(fetched).not.toBeNull();
      expect(fetched?.session_token).toBe("token-1");
      expect(fetched?.expires_at).toBeInstanceOf(Date);
    });

    it("returns null for expired and unknown sessions", async () => {
      await run(createSession(sessionParams("token-1", new Date(Date.now() - 60_000))));

      expect(await run(getSession("token-1"))).toBeNull();
      expect(await run(getSession("missing"))).toBeNull();
    });

    it("deletes a session", async () => {
      await run(createSession(sessionParams("token-1", new Date(Date.now() + 60_000))));

      expect(await run(deleteSession("token-1"))).toBe(1);
      expect(await run(getSession("token-1"))).toBeNull();
    });

    it("sweeps expired pending sessions when a new attempt starts", async () => {
      // No scheduled cleanup job: abandoned flows must not accumulate, so
      // issuing a new pending row also removes the expired ones.
      await run(createSession(sessionParams("stale", new Date(Date.now() - 60_000))));
      await run(createSession(sessionParams("fresh", new Date(Date.now() + 60_000))));

      const rows = await db.selectFrom("oauth_sessions").select("session_token").execute();
      expect(rows.map((row) => row.session_token)).toEqual(["fresh"]);
    });

    it("cleans up expired sessions only", async () => {
      await run(createSession(sessionParams("fresh", new Date(Date.now() + 60_000))));
      // Write the expired row last: creating it sweeps anything already
      // expired, so this is the row the explicit cleanup must find.
      await run(createSession(sessionParams("expired", new Date(Date.now() - 60_000))));

      expect(await run(cleanupSessions())).toBe(1);
      expect(await run(getSession("fresh"))).not.toBeNull();
    });
  });
});

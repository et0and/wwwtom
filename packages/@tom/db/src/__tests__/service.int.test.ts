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
  type OAuthSessionParams,
} from "../service";
import { makeAppConfigLayer } from "@tom/utils/services/config";
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

    // PGlite is WASM — a fresh sandbox instance cold-compiles it, and the
    // migration run follows; the default 10s hook timeout is too tight.
    const result = await migrator.migrateToLatest();
    expect(result.error).toBeUndefined();
    expect(result.results?.map((migration) => migration.status)).toEqual(["Success"]);
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

  const entryParams = (message: string): GuestbookEntryParams => ({
    fediverse_username: "tom@mastodon.social",
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

  const createEntry = (params: GuestbookEntryParams) => (db: DatabaseServiceContract) =>
    db.createGuestbookEntry(params);
  const listEntries = (page: number, pageSize: number) => (db: DatabaseServiceContract) =>
    db.getGuestbookEntries({ page, page_size: pageSize });
  const hasSigned = (username: string) => (db: DatabaseServiceContract) =>
    db.hasUserSigned(username);
  const createSession = (params: OAuthSessionParams) => (db: DatabaseServiceContract) =>
    db.createOAuthSession(params);
  const getSession = (token: string) => (db: DatabaseServiceContract) => db.getOAuthSession(token);
  const deleteSession = (token: string) => (db: DatabaseServiceContract) =>
    db.deleteOAuthSession(token);
  const cleanupSessions = () => (db: DatabaseServiceContract) => db.cleanupExpiredSessions();

  describe("guestbook entries", () => {
    it("creates an entry and returns the row with generated id and timestamps", async () => {
      const entry = await run(createEntry(entryParams("hello")));

      expect(entry.id).toBeGreaterThan(0);
      expect(entry.message).toBe("hello");
      expect(entry.created_at).toBeInstanceOf(Date);
      expect(entry.updated_at).toBeInstanceOf(Date);
    });

    it("lists entries newest first with pagination and totals", async () => {
      await run(createEntry(entryParams("first")));
      await new Promise((resolve) => setTimeout(resolve, 2));
      await run(createEntry(entryParams("second")));
      await new Promise((resolve) => setTimeout(resolve, 2));
      await run(createEntry(entryParams("third")));

      const page1 = await run(listEntries(1, 2));
      expect(page1.total_count).toBe(3);
      expect(page1.page_size).toBe(2);
      expect(page1.results.map((entry) => entry.message)).toEqual(["third", "second"]);

      const page2 = await run(listEntries(2, 2));
      expect(page2.results.map((entry) => entry.message)).toEqual(["first"]);
    });

    it("reports whether a user has signed", async () => {
      await run(createEntry(entryParams("signed")));

      expect(await run(hasSigned("tom@mastodon.social"))).toBe(true);
      expect(await run(hasSigned("someone@elsewhere.social"))).toBe(false);
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

    it("cleans up expired sessions only", async () => {
      await run(createSession(sessionParams("expired", new Date(Date.now() - 60_000))));
      await run(createSession(sessionParams("fresh", new Date(Date.now() + 60_000))));

      expect(await run(cleanupSessions())).toBe(1);
      expect(await run(getSession("fresh"))).not.toBeNull();
    });
  });
});

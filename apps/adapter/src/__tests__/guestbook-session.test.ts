import { describe, expect, it, vi } from "vitest";
import { Effect, Layer } from "effect";
import type { SecureRandom } from "effect/crypto";
import {
  DatabaseService,
  type DatabaseServiceContract,
  type GuestbookEntry,
  type GuestbookSession,
  type OAuthSession,
} from "@tom/db/service";
import { GuestbookConflictError } from "@tom/types/errors";
import { completeAuth } from "../guestbook/auth";
import { endGuestbookSession, guestbookUser, signGuestbook } from "../guestbook/session";
import { cryptoLayer } from "../runtime";

/**
 * The session module owns the guestbook's transitions. These tests drive it
 * with a stub service so the failure paths run without a Postgres instance;
 * the real SQL contract is covered by @tom/db's pglite integration suite.
 */

const unexpected = (operation: string) => () => Effect.die(`unexpected ${operation}`);

const stubDatabase = (
  overrides: Partial<DatabaseServiceContract> = {},
): DatabaseServiceContract => ({
  createGuestbookEntry: unexpected("createGuestbookEntry"),
  getGuestbookEntries: unexpected("getGuestbookEntries"),
  createGuestbookSession: unexpected("createGuestbookSession"),
  getGuestbookSession: unexpected("getGuestbookSession"),
  deleteGuestbookSession: unexpected("deleteGuestbookSession"),
  createOAuthSession: unexpected("createOAuthSession"),
  getOAuthSession: unexpected("getOAuthSession"),
  deleteOAuthSession: unexpected("deleteOAuthSession"),
  cleanupExpiredSessions: Effect.die("unexpected cleanupExpiredSessions"),
  ...overrides,
});

const run = <A, E>(
  effect: Effect.Effect<A, E, DatabaseService | SecureRandom.SecureRandom>,
  database: DatabaseServiceContract,
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(Effect.provide(Layer.merge(Layer.succeed(DatabaseService, database), cryptoLayer))),
  );

const outcome = <A, E>(
  effect: Effect.Effect<A, E, DatabaseService | SecureRandom.SecureRandom>,
  database: DatabaseServiceContract,
) =>
  run(
    Effect.match(effect, {
      onFailure: (error) => error,
      onSuccess: (value) => value,
    }),
    database,
  );

const storedSession = (overrides: Partial<GuestbookSession> = {}): GuestbookSession => ({
  id: 1,
  session_token: "session-1",
  fediverse_username: "tom@mastodon.social",
  fediverse_instance: "mastodon.social",
  display_name: "Tom",
  avatar_url: "https://mastodon.social/avatar.png",
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  expires_at: new Date("2099-01-01T00:00:00.000Z"),
  ...overrides,
});

const storedEntry = (overrides: Partial<GuestbookEntry> = {}): GuestbookEntry => ({
  id: 1,
  fediverse_username: "tom@mastodon.social",
  fediverse_instance: "mastodon.social",
  display_name: "Tom",
  avatar_url: "https://mastodon.social/avatar.png",
  message: "hello",
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  updated_at: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const pendingOAuth = (overrides: Partial<OAuthSession> = {}): OAuthSession => ({
  id: 1,
  session_token: "pending-1",
  fediverse_instance: "mastodon.social",
  client_id: "client-id",
  client_secret: "client-secret",
  state: "expected-state",
  code_verifier: null,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  expires_at: new Date("2099-01-01T00:00:00.000Z"),
  ...overrides,
});

describe("guestbook session identity", () => {
  it("returns the stored identity without an access token", async () => {
    const user = await run(
      guestbookUser("session-1"),
      stubDatabase({ getGuestbookSession: () => Effect.succeed(storedSession()) }),
    );

    expect(user).toEqual({
      username: "tom",
      instance: "mastodon.social",
      display_name: "Tom",
      avatar_url: "https://mastodon.social/avatar.png",
    });
    expect(user).not.toHaveProperty("access_token");
  });

  it("treats an unknown or expired token as signed out", async () => {
    const user = await run(
      guestbookUser("stale"),
      stubDatabase({ getGuestbookSession: () => Effect.succeed(null) }),
    );
    expect(user).toBeNull();
  });

  it("never reads the database for an empty token", async () => {
    const user = await run(guestbookUser(""), stubDatabase());
    expect(user).toBeNull();
  });
});

describe("guestbook signing", () => {
  it("signs as the session identity, not client input", async () => {
    const createEntry = vi.fn(() => Effect.succeed(storedEntry()));
    const entry = await run(
      signGuestbook({ sessionToken: "session-1", message: "hello" }),
      stubDatabase({
        getGuestbookSession: () => Effect.succeed(storedSession()),
        createGuestbookEntry: createEntry,
      }),
    );

    expect(createEntry).toHaveBeenCalledWith({
      fediverse_username: "tom@mastodon.social",
      fediverse_instance: "mastodon.social",
      display_name: "Tom",
      avatar_url: "https://mastodon.social/avatar.png",
      message: "hello",
    });
    expect(entry).toMatchObject({ message: "hello" });
  });

  it("rejects a missing or expired session as unauthenticated", async () => {
    const error = await outcome(
      signGuestbook({ sessionToken: "stale", message: "hello" }),
      stubDatabase({ getGuestbookSession: () => Effect.succeed(null) }),
    );
    expect(error).toMatchObject({ _tag: "AuthenticationError" });
  });

  it("propagates the duplicate-signature conflict", async () => {
    const error = await outcome(
      signGuestbook({ sessionToken: "session-1", message: "again" }),
      stubDatabase({
        getGuestbookSession: () => Effect.succeed(storedSession()),
        createGuestbookEntry: () =>
          Effect.fail(
            new GuestbookConflictError({ message: "You have already signed the guestbook" }),
          ),
      }),
    );
    expect(error).toMatchObject({
      _tag: "GuestbookConflictError",
      message: "You have already signed the guestbook",
    });
  });
});

describe("guestbook logout", () => {
  it("revokes the stored row", async () => {
    const deleteSession = vi.fn(() => Effect.succeed(1));
    await run(
      endGuestbookSession("session-1"),
      stubDatabase({ deleteGuestbookSession: deleteSession }),
    );
    expect(deleteSession).toHaveBeenCalledWith("session-1");
  });

  it("does not touch the database without a token", async () => {
    await run(endGuestbookSession(""), stubDatabase());
  });
});

describe("OAuth state validation", () => {
  const callback = (state: string) =>
    completeAuth({
      code: "code-1",
      state,
      session_token: "pending-1",
      redirectUri: "https://adapter.tom.so/guestbook/callback",
    });

  it("rejects a callback minted for another browser", async () => {
    const deleteSession = vi.fn(() => Effect.succeed(1));
    const error = await outcome(
      callback("attacker-state"),
      stubDatabase({
        getOAuthSession: () => Effect.succeed(pendingOAuth()),
        deleteOAuthSession: deleteSession,
      }),
    );

    expect(error).toMatchObject({ _tag: "OAuthSessionError", message: "Invalid OAuth state" });
    // The pending row is burned so the mismatched callback cannot be replayed.
    expect(deleteSession).toHaveBeenCalledWith("pending-1");
  });

  it("rejects a callback with no state", async () => {
    const error = await outcome(
      callback(""),
      stubDatabase({
        getOAuthSession: () => Effect.succeed(pendingOAuth()),
        deleteOAuthSession: () => Effect.succeed(1),
      }),
    );
    expect(error).toMatchObject({ _tag: "OAuthSessionError", message: "Invalid OAuth state" });
  });

  it("rejects an unknown or expired pending session", async () => {
    const error = await outcome(
      callback("expected-state"),
      stubDatabase({ getOAuthSession: () => Effect.succeed(null) }),
    );
    expect(error).toMatchObject({
      _tag: "OAuthSessionError",
      message: "Invalid or expired session",
    });
  });
});

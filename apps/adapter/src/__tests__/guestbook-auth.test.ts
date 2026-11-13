import { describe, expect, it, vi } from "vitest";
import { Effect, Layer } from "effect";
import {
  DatabaseService,
  type DatabaseServiceContract,
  type OAuthSessionParams,
} from "@tom/db/service";
import { initiateAuth } from "../guestbook/auth";
import { cryptoLayer } from "../runtime";

// The provider app registration is external; the detector is too. Stub both
// so the test exercises the state/token transition this module owns.
vi.mock("megalodon", () => ({
  default: () => ({
    registerApp: async () => ({
      client_id: "client-id",
      client_secret: "client-secret",
      // The provider client may put its own state in the URL; ours must win.
      url: "https://mastodon.social/oauth/authorize?client_id=client-id&state=provider-generated",
    }),
  }),
}));

vi.mock("../guestbook/detector", async () => {
  const { Effect } = await import("effect");
  return {
    detector: () => Effect.fail({ _tag: "NodeinfoError", message: "nodeinfo unavailable" }),
  };
});

const unexpected = () => () => Effect.die("unexpected database call");

const stubDatabase = (
  overrides: Partial<DatabaseServiceContract> = {},
): DatabaseServiceContract => ({
  createGuestbookEntry: unexpected(),
  getGuestbookEntries: unexpected(),
  createGuestbookSession: unexpected(),
  getGuestbookSession: unexpected(),
  deleteGuestbookSession: unexpected(),
  createOAuthSession: unexpected(),
  getOAuthSession: unexpected(),
  deleteOAuthSession: unexpected(),
  cleanupExpiredSessions: Effect.die("unexpected cleanupExpiredSessions"),
  ...overrides,
});

describe("Fediverse OAuth initiate", () => {
  it("stores the state and puts the same value in the authorize URL", async () => {
    const stored: Array<OAuthSessionParams> = [];
    const result = await Effect.runPromise(
      initiateAuth("tom@mastodon.social", "https://adapter.tom.so/guestbook/callback").pipe(
        Effect.provide(
          Layer.merge(
            Layer.succeed(
              DatabaseService,
              stubDatabase({
                createOAuthSession: (params) => {
                  stored.push(params);
                  return Effect.succeed({
                    id: 1,
                    ...params,
                    created_at: new Date(),
                  });
                },
              }),
            ),
            cryptoLayer,
          ),
        ),
      ),
    );

    expect(stored).toHaveLength(1);
    const pending = stored[0];
    expect(pending).toBeDefined();
    expect(pending?.state).toMatch(/^[0-9a-f]{32}$/);
    expect(pending?.expires_at.getTime()).toBeGreaterThan(Date.now());

    const url = new URL(result.authUrl);
    expect(url.hostname).toBe("mastodon.social");
    expect(url.searchParams.get("state")).toBe(pending?.state);
    // The provider's own state is replaced, not appended.
    expect(url.searchParams.getAll("state")).toEqual([pending?.state]);
    expect(url.searchParams.get("client_id")).toBe("client-id");
  });

  it("issues a distinct callback token and state on every attempt", async () => {
    const stored: Array<OAuthSessionParams> = [];
    const database = stubDatabase({
      createOAuthSession: (params) => {
        stored.push(params);
        return Effect.succeed({ id: stored.length, ...params, created_at: new Date() });
      },
    });
    const run = () =>
      Effect.runPromise(
        initiateAuth("tom@mastodon.social", "https://adapter.tom.so/guestbook/callback").pipe(
          Effect.provide(Layer.merge(Layer.succeed(DatabaseService, database), cryptoLayer)),
        ),
      );

    await run();
    await run();

    expect(stored[0]?.session_token).not.toBe(stored[1]?.session_token);
    expect(stored[0]?.state).not.toBe(stored[1]?.state);
  });
});

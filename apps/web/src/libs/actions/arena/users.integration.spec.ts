import { describe, it, expect, beforeAll } from "vitest";
import { Effect, Layer, Redacted } from "effect";
import { ArenaService, ArenaServiceLive } from "@tom/arena/service";
import { AppConfig } from "@tom/utils/services";
import { fetchArena } from "~/libs/actions/arena/client";

function getArenaToken(): string | undefined {
  return (
    (typeof process !== "undefined" ? process.env?.ARENA_TOKEN : undefined) ||
    import.meta.env.ARENA_TOKEN
  );
}

function createTestLayer() {
  const token = getArenaToken() ?? "";
  const configLayer = Layer.succeed(AppConfig, {
    arenaToken: Redacted.make(token),
    payloadUrl: Redacted.make(""),
    databaseUrl: Redacted.make(""),
    telegramBotToken: undefined,
    telegramChatId: undefined,
    isDev: true,
  });
  return Layer.provideMerge(ArenaServiceLive, configLayer);
}

function runTestEffect<A, E>(effect: Effect.Effect<A, E, ArenaService>): Promise<A> {
  const layer = createTestLayer();
  const provided = Effect.provide(effect, layer);
  return Effect.runPromise(provided);
}

describe("Are.na user lookup", () => {
  beforeAll(() => {
    const hasToken = !!getArenaToken();
    if (!hasToken) {
      void Effect.runFork(Effect.logWarning("ARENA_TOKEN not found, skipping integration tests"));
    }
  });

  describe("getUser", () => {
    it("should fetch a user by ID", async () => {
      const hasToken = !!getArenaToken();
      if (!hasToken) {
        void Effect.runFork(Effect.logWarning("Skipping test: ARENA_TOKEN not available"));
        return;
      }
      const result = await runTestEffect(
        fetchArena((client) => client.user(72639).get(), "getUser(72639)"),
      );

      expect(result).toBeDefined();
      void Effect.runFork(Effect.logDebug("Fetched user:", result));
    });
  });

  describe("getUserChannels", () => {
    // are.na API returns 401 for viewing other users' channels - requires specific permissions
    it.skip("should fetch channels belonging to a single user", async () => {
      const hasToken = !!getArenaToken();
      if (!hasToken) {
        void Effect.runFork(Effect.logWarning("Skipping test: ARENA_TOKEN not available"));
        return;
      }
      const result = await runTestEffect(
        fetchArena((client) => client.user(72639).channels({ per: 10 }), "getUserChannels(72639)"),
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty("channels");
      expect(Array.isArray(result.channels)).toBe(true);
      void Effect.runFork(Effect.logDebug("Fetched channels:", result.channels));
    });
  });
});

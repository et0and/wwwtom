import { describe, it, expect, beforeAll } from "vitest";
import { Effect, Layer } from "effect";
import { ArenaService } from "@tom/arena/service";
import { makeAppConfigLayer } from "@tom/utils/services";
import { fetchArena } from "~/libs/actions/arena/client";

function getArenaToken(): string | undefined {
  return (
    (typeof process !== "undefined" ? process.env?.ARENA_TOKEN : undefined) ||
    import.meta.env.ARENA_TOKEN
  );
}

function createTestLayer() {
  const token = getArenaToken() ?? "";
  const configLayer = makeAppConfigLayer({
    ARENA_TOKEN: token,
    PAYLOAD_URL: "",
    DATABASE_URL: "",
    NODE_ENV: "development",
  });
  return Layer.provideMerge(ArenaService.Default, configLayer);
}

function runTestEffect<A, E>(effect: Effect.Effect<A, E, ArenaService>): Promise<A> {
  const layer = createTestLayer();
  const provided = Effect.provide(effect, layer);
  return Effect.runPromise(provided);
}

describe("Are.na channel integration", () => {
  beforeAll(() => {
    const hasToken = !!getArenaToken();
    if (!hasToken) {
      void Effect.runFork(Effect.logWarning("ARENA_TOKEN not found, skipping integration tests"));
    }
  });

  describe("getChannelContents", () => {
    it("should fetch channel contents with pagination", async () => {
      const hasToken = !!getArenaToken();
      if (!hasToken) {
        void Effect.runFork(Effect.logWarning("Skipping test: ARENA_TOKEN not available"));
        return;
      }
      const result = await runTestEffect(
        fetchArena(
          (client) => client.channel("imaginary-museum").contents({ per: 10 }),
          "getChannelContents(imaginary-museum)",
        ),
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty("data");
      expect(Array.isArray(result.data)).toBe(true);
      void Effect.runFork(Effect.logDebug("Fetched contents:", result.data));
    });
  });

  describe("getChannel", () => {
    it("should fetch a single channel by slug", async () => {
      const hasToken = !!getArenaToken();
      if (!hasToken) {
        void Effect.runFork(Effect.logWarning("Skipping test: ARENA_TOKEN not available"));
        return;
      }
      const result = await runTestEffect(
        fetchArena(
          (client) => client.channel("imaginary-museum").get(),
          "getChannel(imaginary-museum)",
        ),
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty("slug");
      expect(result.slug).toBe("imaginary-museum");
      void Effect.runFork(Effect.logDebug("Fetched channel:", result));
    });
  });
});

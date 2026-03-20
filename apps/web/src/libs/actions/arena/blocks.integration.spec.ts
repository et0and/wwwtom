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

describe("Are.na block integration", () => {
  beforeAll(() => {
    const hasToken = !!getArenaToken();
    if (!hasToken) {
      void Effect.runFork(Effect.logWarning("ARENA_TOKEN not found, skipping integration tests"));
    }
  });

  describe("getBlock", () => {
    it("should fetch a single block by ID", async () => {
      const hasToken = !!getArenaToken();
      if (!hasToken) {
        void Effect.runFork(Effect.logWarning("Skipping test: ARENA_TOKEN not available"));
        return;
      }
      const result = await runTestEffect(
        fetchArena((client) => client.block(6576052).get(), "getBlock(6576052)"),
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty("id");
      expect(result.id).toBe(6576052);
      void Effect.runFork(Effect.logDebug("Fetched block:", result));
    });
  });

  describe("getBlockChannels", () => {
    it("should fetch channels containing a block with pagination", async () => {
      const hasToken = !!getArenaToken();
      if (!hasToken) {
        void Effect.runFork(Effect.logWarning("Skipping test: ARENA_TOKEN not available"));
        return;
      }
      const result = await runTestEffect(
        fetchArena(
          (client) => client.block(6576052).channels({ per: 10 }),
          "getBlockChannels(6576052)",
        ),
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty("channels");
      expect(Array.isArray(result.channels)).toBe(true);
      void Effect.runFork(Effect.logDebug("Fetched channels:", result.channels));
    });
  });

  describe("getBlockComments", () => {
    // skipping this for now as I think I might have hit are.na too hard :(
    it.skip("should fetch comments for a block with pagination", async () => {
      const hasToken = !!getArenaToken();
      if (!hasToken) {
        void Effect.runFork(Effect.logWarning("Skipping test: ARENA_TOKEN not available"));
        return;
      }
      const result = await runTestEffect(
        fetchArena(
          (client) => client.block(6576052).comments({ per: 10 }),
          "getBlockComments(6576052)",
        ),
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty("comments");
      expect(Array.isArray(result.comments)).toBe(true);
      void Effect.runFork(Effect.logDebug("Fetched comments:", result.comments));
    });
  });
});

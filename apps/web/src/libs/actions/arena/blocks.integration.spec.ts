import { describe, it, expect, beforeAll } from "vitest";
import { fetchArena } from "~/libs/actions/arena/client";
import { logger, runServerEffect } from "@tom/utils";

describe("Are.na block integration", () => {
  beforeAll(() => {
    const tokenValue =
      (typeof process !== "undefined" ? process.env?.ARENA_TOKEN : undefined) ||
      import.meta.env.ARENA_TOKEN;
    const hasToken = !!tokenValue;
    if (!hasToken) {
      logger.warn("ARENA_TOKEN not found, skipping integration tests");
    }
  });

  describe("getBlock", () => {
    it("should fetch a single block by ID", async () => {
      const tokenValue =
        (typeof process !== "undefined" ? process.env?.ARENA_TOKEN : undefined) ||
        import.meta.env.ARENA_TOKEN;
      const hasToken = !!tokenValue;
      if (!hasToken) {
        logger.warn("Skipping test: ARENA_TOKEN not available");
        return;
      }
      const result = await runServerEffect(
        fetchArena((client) => client.block(6576052).get(), "getBlock(6576052)"),
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty("id");
      expect(result.id).toBe(6576052);
      logger.debug("Fetched block:", result);
    });
  });

  describe("getBlockChannels", () => {
    it("should fetch channels containing a block with pagination", async () => {
      const hasToken = !!(
        (typeof process !== "undefined" ? process.env?.ARENA_TOKEN : undefined) ||
        import.meta.env.ARENA_TOKEN
      );
      if (!hasToken) {
        logger.warn("Skipping test: ARENA_TOKEN not available");
        return;
      }
      const result = await runServerEffect(
        fetchArena(
          (client) => client.block(6576052).channels({ per: 10 }),
          "getBlockChannels(6576052)",
        ),
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty("channels");
      expect(Array.isArray(result.channels)).toBe(true);
      logger.debug("Fetched channels:", result.channels);
    });
  });

  describe("getBlockComments", () => {
    // skipping this for now as I think I might have hit are.na too hard :(
    it.skip("should fetch comments for a block with pagination", async () => {
      const hasToken = !!(
        (typeof process !== "undefined" ? process.env?.ARENA_TOKEN : undefined) ||
        import.meta.env.ARENA_TOKEN
      );
      if (!hasToken) {
        logger.warn("Skipping test: ARENA_TOKEN not available");
        return;
      }
      const result = await runServerEffect(
        fetchArena(
          (client) => client.block(6576052).comments({ per: 10 }),
          "getBlockComments(6576052)",
        ),
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty("comments");
      expect(Array.isArray(result.comments)).toBe(true);
      logger.debug("Fetched comments:", result.comments);
    });
  });
});

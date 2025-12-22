import { describe, it, expect, beforeAll } from "vitest";
import { fetchArena } from "~/libs/actions/arena/client";
import { logger, runServerEffect } from "~/libs/utils/logger";

describe("Are.na channel integration", () => {
	beforeAll(() => {
		const tokenValue =
			(typeof process !== "undefined" ? process.env?.ARENA_TOKEN : undefined) ||
			import.meta.env.ARENA_TOKEN;
		const hasToken = !!tokenValue;
		if (!hasToken) {
			logger.warn("ARENA_TOKEN not found, skipping integration tests");
		}
	});

	describe("getChannelContents", () => {
		it("should fetch channel contents with pagination", async () => {
			const tokenValue =
				(typeof process !== "undefined"
					? process.env?.ARENA_TOKEN
					: undefined) || import.meta.env.ARENA_TOKEN;
			const hasToken = !!tokenValue;
			if (!hasToken) {
				logger.warn("Skipping test: ARENA_TOKEN not available");
				return;
			}
			const result = await runServerEffect(
				fetchArena(
					(client) => client.channel("imaginary-museum").contents({ per: 10 }),
					"getChannelContents(imaginary-museum)",
				),
			);

			expect(result).toBeDefined();
			expect(result).toHaveProperty("contents");
			expect(Array.isArray(result.contents)).toBe(true);
			logger.debug("Fetched contents:", result.contents);
		});
	});

	describe("getChannel", () => {
		it("should fetch a single channel by slug", async () => {
			const hasToken = !!(
				(typeof process !== "undefined"
					? process.env?.ARENA_TOKEN
					: undefined) || import.meta.env.ARENA_TOKEN
			);
			if (!hasToken) {
				logger.warn("Skipping test: ARENA_TOKEN not available");
				return;
			}
			const result = await runServerEffect(
				fetchArena(
					(client) => client.channel("imaginary-museum").get(),
					"getChannel(imaginary-museum)",
				),
			);

			expect(result).toBeDefined();
			expect(result).toHaveProperty("slug");
			expect(result.slug).toBe("imaginary-museum");
			logger.debug("Fetched channel:", result);
		});
	});
});

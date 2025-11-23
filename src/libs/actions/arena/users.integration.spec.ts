import { describe, it, expect, beforeAll } from "vitest";
import { fetchArena } from "~/libs/actions/arena/client";
import { logger, runServerEffect } from "~/libs/utils/logger";

describe("Are.na user lookup", () => {
	beforeAll(() => {
		const hasToken = !!(
			(typeof process !== "undefined" ? process.env?.ARENA_TOKEN : undefined) ||
			import.meta.env.ARENA_TOKEN
		);
		if (!hasToken) {
			console.warn("ARENA_TOKEN not found, skipping integration tests");
		}
	});

	describe("getUser", () => {
		it("should fetch a user by ID", async () => {
			const hasToken = !!(
				(typeof process !== "undefined"
					? process.env?.ARENA_TOKEN
					: undefined) || import.meta.env.ARENA_TOKEN
			);
			if (!hasToken) {
				console.warn("Skipping test: ARENA_TOKEN not available");
				return;
			}
			const result = await runServerEffect(
				fetchArena((client) => client.user(72639).get(), "getUser(72639)"),
			);

			expect(result).toBeDefined();
			logger.debug("Fetched user:", result);
		});
	});

	describe("getUserChannels", () => {
		it("should fetch channels belonging to a single user", async () => {
			const hasToken = !!(
				(typeof process !== "undefined"
					? process.env?.ARENA_TOKEN
					: undefined) || import.meta.env.ARENA_TOKEN
			);
			if (!hasToken) {
				console.warn("Skipping test: ARENA_TOKEN not available");
				return;
			}
			const result = await runServerEffect(
				fetchArena(
					(client) => client.user(72639).channels({ per: 10 }),
					"getUserChannels(72639)",
				),
			);

			expect(result).toBeDefined();
			expect(result).toHaveProperty("channels");
			expect(Array.isArray(result.channels)).toBe(true);
			logger.debug("Fetched channels:", result.channels);
		});
	});
});

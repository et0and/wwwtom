import { describe, it, expect } from "vitest";
import { fetchArena } from "~/libs/actions/arena/client";
import { logger } from "~/libs/utils/logger";

describe("Are.na user lookup", () => {
	describe("getUser", () => {
		it("should fetch a user by ID", async () => {
			const result = await fetchArena(
				(client) => client.user(72639).get(),
				"getUser(72639)",
			);

			result.match(
				(user) => {
					expect(user).toBeDefined();
					logger.debug("Fetched user:", user);
				},
				(error) => {
					throw error;
				},
			);
		});
	});

	describe("getUserChannels", () => {
		it("should fetch channels belonging to a single user", async () => {
			const result = await fetchArena(
				(client) => client.user(72639).channels({ per: 10 }),
				"getUserChannels(72639)",
			);

			result.match(
				(response) => {
					expect(response).toBeDefined();
					expect(response).toHaveProperty("channels");
					expect(Array.isArray(response.channels)).toBe(true);
					logger.debug("Fetched channels:", response.channels);
				},
				(error) => {
					throw error;
				},
			);
		});
	});
});

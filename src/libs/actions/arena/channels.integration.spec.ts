import { describe, it, expect } from "vitest";
import { fetchArena } from "~/libs/actions/arena/client";
import { logger } from "~/libs/utils/logger";

describe("Are.na channel integration", () => {
	describe("getChannelContents", () => {
		it("should fetch channel contents with pagination", async () => {
			const result = await fetchArena(
				(client) => client.channel("imaginary-museum").contents({ per: 10 }),
				"getChannelContents(imaginary-museum)",
			);

			result.match(
				(response) => {
					expect(response).toBeDefined();
					expect(response).toHaveProperty("contents");
					expect(Array.isArray(response.contents)).toBe(true);
					logger.debug("Fetched contents:", response.contents);
				},
				(error) => {
					throw error;
				},
			);
		});
	});

	describe("getChannel", () => {
		it("should fetch a single channel by slug", async () => {
			const result = await fetchArena(
				(client) => client.channel("imaginary-museum").get(),
				"getChannel(imaginary-museum)",
			);

			result.match(
				(channel) => {
					expect(channel).toBeDefined();
					expect(channel).toHaveProperty("slug");
					expect(channel.slug).toBe("imaginary-museum");
					logger.debug("Fetched channel:", channel);
				},
				(error) => {
					throw error;
				},
			);
		});
	});
});

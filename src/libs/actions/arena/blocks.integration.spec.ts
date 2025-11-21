import { describe, it, expect } from "vitest";
import { fetchArena } from "~/libs/actions/arena/client";

describe("Are.na block integration", () => {
	describe("getBlock", () => {
		it("should fetch a single block by ID", async () => {
			const result = await fetchArena(
				(client) => client.block(6576052).get(),
				"getBlock(6576052)",
			);

			result.match(
				(block) => {
					expect(block).toBeDefined();
					expect(block).toHaveProperty("id");
					expect(block.id).toBe(6576052);
				},
				(error) => {
					throw error;
				},
			);
		});
	});

	describe("getBlockChannels", () => {
		it("should fetch channels containing a block with pagination", async () => {
			const result = await fetchArena(
				(client) => client.block(6576052).channels({ per: 10 }),
				"getBlockChannels(6576052)",
			);

			result.match(
				(response) => {
					expect(response).toBeDefined();
					expect(response).toHaveProperty("channels");
					expect(Array.isArray(response.channels)).toBe(true);
				},
				(error) => {
					throw error;
				},
			);
		});
	});

	//gonna need to revisit this one once I have good examples of blocks with comments, plus a valid token
	/* describe("getBlockComments", () => {
		it("should fetch comments for a block with pagination", async () => {
			const result = await fetchArena(
				(client) => client.block(6576052).comments({ per: 10 }),
				"getBlockComments(6576052)",
			);

			result.match(
				(response) => {
					expect(response).toBeDefined();
					expect(response).toHaveProperty("comments");
					expect(Array.isArray(response.comments)).toBe(true);
				},
				(error) => {
					// Skip gracefully if token not set, not authenticated, or block not found
					if (
						error.message.includes("Unauthorized") ||
						error.message.includes("404")
					) {
						expect(true).toBe(true);
					} else {
						throw error;
					}
				},
			);
		});
	}); */
});

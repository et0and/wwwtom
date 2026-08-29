import { describe, expect, it } from "vitest";
import { Elysia } from "elysia";
import { Schema } from "effect";
import { AddressSearchQuerySchema } from "@tom/schemas/address";
import { toOpenApiSchema } from "../openapi";

const searchQuerySchema = toOpenApiSchema(AddressSearchQuerySchema);

describe("Elysia query validation with comma", () => {
  const app = new Elysia().get(
    "/v1/search",
    ({ query }) => {
      const raw = Schema.decodeUnknownSync(AddressSearchQuerySchema)(query);
      const qValue: string = Array.isArray(raw.q) ? raw.q.join(",") : (raw.q as string);
      return { q: qValue, raw };
    },
    {
      query: searchQuerySchema,
    },
  );

  it("accepts q without comma", async () => {
    const response = await app.handle(
      new Request("http://localhost/v1/search?q=Dominion%20road&limit=20"),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { q: string };
    expect(body.q).toBe("Dominion road");
  });

  it("accepts q with comma encoded as %2C", async () => {
    const response = await app.handle(
      new Request("http://localhost/v1/search?q=Dominion%20road%2C%204&limit=20"),
    );
    expect(response.status).not.toBe(400);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { q: string };
    expect(body.q).toBe("Dominion road, 4");
  });

  it("accepts q with comma and space via Elysia array split", async () => {
    // Elysia splits q=Dominion road, 4 into q: ["Dominion road", " 4"]
    const response = await app.handle(
      new Request("http://localhost/v1/search?q=Dominion%20road,%204&limit=20"),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { q: string };
    expect(body.q).toBe("Dominion road, 4");
  });

  it("accepts bbox with commas", async () => {
    const response = await app.handle(
      new Request("http://localhost/v1/search?q=dominion&bbox=174.7,-41.2,174.8,-41.1&limit=5"),
    );
    expect(response.status).toBe(200);
  });

  it("accepts bbox encoded as %2C", async () => {
    const response = await app.handle(
      new Request(
        "http://localhost/v1/search?q=dominion&bbox=174.7%2C-41.2%2C174.8%2C-41.1&limit=5",
      ),
    );
    expect(response.status).toBe(200);
  });
});

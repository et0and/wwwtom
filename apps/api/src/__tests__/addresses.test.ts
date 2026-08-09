import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { HttpError } from "@tom/types/errors";
import { createAddressRoutes } from "../routes/addresses";
import { requestWithEnv } from "../test/helpers";
import type { AddressServices } from "../services/address";
import type { Address, AddressFilters, Meta } from "../services/address/addresses";
import type { IngestStart } from "../services/address/ingest";

const address = (id: number): Address => ({
  addressId: id,
  fullAddress: `1 Lambton Quay, Wellington ${id}`,
  fullAddressNumber: "1",
  fullAddressRoad: "Lambton Quay",
  suburb: "Wellington Central",
  townCity: "Wellington",
  territorialAuthority: "Wellington City",
  region: "Wellington",
  postcode: null,
  longitude: 174.7762,
  latitude: -41.2865,
});

const meta: Meta = {
  version: "1.1.0",
  totalAddresses: 1000,
  lastUpdated: "2026-01-01T00:00:00.000Z",
};

const queued: IngestStart = {
  status: "queued",
  version: "v1",
  runId: "run-1",
  total: 10,
};

interface FakeOverrides {
  getAddressById?: (id: number) => Effect.Effect<Address | null, HttpError>;
  listAddresses?: (filters: AddressFilters) => Effect.Effect<readonly Address[], HttpError>;
  searchAddresses?: (
    query: string,
    limit: number,
    bbox?: readonly [number, number, number, number],
  ) => Effect.Effect<readonly Address[], HttpError>;
  reverseGeocode?: (
    lng: number,
    lat: number,
    limit: number,
  ) => Effect.Effect<readonly Address[], HttpError>;
  getMeta?: () => Effect.Effect<Meta, HttpError>;
  getChallenge?: () => Effect.Effect<
    { challenge: string; token: string; difficulty: number; expiresAt: number },
    HttpError
  >;
  requestApiKey?: (
    challenge: string,
    nonce: number,
    token: string,
  ) => Effect.Effect<{ apiKey: string; rateLimit: number }, HttpError>;
  startIngestion?: () => Effect.Effect<IngestStart, HttpError>;
  ingestRun?: (runId: string, version: string, total: number) => Effect.Effect<void, HttpError>;
  authenticateApiKey?: (
    apiKey: string | undefined,
    ip: string,
  ) => Effect.Effect<
    { allowed: boolean; status?: number; message?: string; retryAfter?: number },
    never
  >;
  authenticateAdmin?: (
    adminKey: string | undefined,
  ) => Effect.Effect<{ allowed: boolean; status?: number; message?: string }, never>;
}

const makeServices = (overrides: FakeOverrides = {}): AddressServices => ({
  getAddressById: (id) => Effect.succeed(id === 123 ? address(123) : null),
  listAddresses: () => Effect.succeed([address(123)]),
  searchAddresses: () => Effect.succeed([address(123)]),
  reverseGeocode: () => Effect.succeed([address(123)]),
  getMeta: () => Effect.succeed(meta),
  getChallenge: () =>
    Effect.succeed({
      challenge: "challenge-1",
      token: "token-1",
      difficulty: 2,
      expiresAt: 9999999999,
    }),
  requestApiKey: () => Effect.succeed({ apiKey: "new-key", rateLimit: 60 }),
  startIngestion: () => Effect.succeed(queued),
  ingestRun: () => Effect.void,
  authenticateApiKey: (apiKey) =>
    Effect.succeed(
      apiKey === "good-key"
        ? { allowed: true }
        : { allowed: false, status: 401, message: "Invalid API key" },
    ),
  authenticateAdmin: (adminKey) =>
    Effect.succeed(
      adminKey === "admin-key"
        ? { allowed: true }
        : { allowed: false, status: 403, message: "Invalid admin key" },
    ),
  ...overrides,
});

const fetchRoute = (url: string, init?: RequestInit) => {
  const app = createAddressRoutes(async () => makeServices());
  return app.fetch(requestWithEnv(url, { NODE_ENV: "test" }, init));
};

describe("address routes", () => {
  describe("GET /v1/addresses/:id", () => {
    it("returns an address with the API key", async () => {
      const response = await fetchRoute("http://localhost/v1/addresses/123", {
        headers: { "x-api-key": "good-key" },
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        addressId: 123,
        fullAddress: "1 Lambton Quay, Wellington 123",
        fullAddressNumber: "1",
        fullAddressRoad: "Lambton Quay",
        suburb: "Wellington Central",
        townCity: "Wellington",
        territorialAuthority: "Wellington City",
        region: "Wellington",
        postcode: null,
        longitude: 174.7762,
        latitude: -41.2865,
      });
    });

    it("returns 404 when the address does not exist", async () => {
      const response = await fetchRoute("http://localhost/v1/addresses/999", {
        headers: { "x-api-key": "good-key" },
      });
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "address not found" });
    });

    it("requires an API key", async () => {
      const response = await fetchRoute("http://localhost/v1/addresses/123");
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Invalid API key" });
    });
  });

  describe("GET /v1/addresses", () => {
    it("lists addresses and passes filters through", async () => {
      let received: AddressFilters | undefined;
      const app = createAddressRoutes(async () =>
        makeServices({
          listAddresses: (filters) => {
            received = filters;
            return Effect.succeed([address(123)]);
          },
        }),
      );
      const response = await app.fetch(
        requestWithEnv(
          "http://localhost/v1/addresses?town_city=Wellington&suburb_locality=Te%20Aro&limit=50&offset=10",
          { NODE_ENV: "test" },
          { headers: { "x-api-key": "good-key" } },
        ),
      );
      expect(response.status).toBe(200);
      expect(received).toEqual({
        limit: 50,
        offset: 10,
        townCity: "Wellington",
        suburbLocality: "Te Aro",
        roadName: undefined,
        bbox: undefined,
      });
    });

    it("rejects an invalid bbox", async () => {
      const response = await fetchRoute("http://localhost/v1/addresses?bbox=1,2,3", {
        headers: { "x-api-key": "good-key" },
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "Invalid bbox format. Expected: minLng,minLat,maxLng,maxLat",
      });
    });
  });

  describe("GET /v1/search", () => {
    it("searches with the query and limit", async () => {
      let received: { query: string; limit: number; bbox: unknown } | undefined;
      const app = createAddressRoutes(async () =>
        makeServices({
          searchAddresses: (query, limit, bbox) => {
            received = { query, limit, bbox };
            return Effect.succeed([address(123)]);
          },
        }),
      );
      const response = await app.fetch(
        requestWithEnv(
          "http://localhost/v1/search?q=lambton%20quay&limit=20",
          {
            NODE_ENV: "test",
          },
          { headers: { "x-api-key": "good-key" } },
        ),
      );
      expect(response.status).toBe(200);
      expect(received).toEqual({ query: "lambton quay", limit: 20, bbox: undefined });
    });

    it("returns 400 when the query is empty", async () => {
      const response = await fetchRoute("http://localhost/v1/search?q=%20%20", {
        headers: { "x-api-key": "good-key" },
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Search query is required" });
    });
  });

  describe("GET /v1/reverse", () => {
    it("returns 400 for invalid coordinates", async () => {
      const response = await fetchRoute("http://localhost/v1/reverse?lat=abc&lng=174", {
        headers: { "x-api-key": "good-key" },
      });
      expect(response.status).toBe(400);
    });

    it("returns the nearest addresses", async () => {
      const response = await fetchRoute(
        "http://localhost/v1/reverse?lat=-41.2865&lng=174.7762&limit=5",
        { headers: { "x-api-key": "good-key" } },
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([address(123)]);
    });
  });

  describe("GET /v1/meta", () => {
    it("returns dataset metadata", async () => {
      const response = await fetchRoute("http://localhost/v1/meta", {
        headers: { "x-api-key": "good-key" },
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(meta);
    });
  });

  describe("GET /challenge", () => {
    it("returns a proof-of-work challenge", async () => {
      const response = await fetchRoute("http://localhost/challenge");
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        challenge: "challenge-1",
        token: "token-1",
        difficulty: 2,
        expiresAt: 9999999999,
      });
    });
  });

  describe("POST /request-key", () => {
    it("issues an API key with a solved proof", async () => {
      const response = await fetchRoute("http://localhost/request-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challenge: "challenge-1", nonce: 42, token: "token-1" }),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ apiKey: "new-key", rateLimit: 60 });
    });

    it("returns 428 when the proof is invalid", async () => {
      const app = createAddressRoutes(async () =>
        makeServices({
          requestApiKey: () =>
            Effect.fail(new HttpError({ message: "Invalid proof", status: 428 })),
        }),
      );
      const response = await app.fetch(
        requestWithEnv(
          "http://localhost/request-key",
          { NODE_ENV: "test" },
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ challenge: "challenge-1", nonce: 1, token: "token-1" }),
          },
        ),
      );
      expect(response.status).toBe(428);
      expect(await response.json()).toEqual({ error: "Invalid proof" });
    });
  });

  describe("POST /ingest-init", () => {
    it("requires the admin key", async () => {
      const response = await fetchRoute("http://localhost/ingest-init", { method: "POST" });
      expect(response.status).toBe(403);
    });

    it("returns the queued status and spawns the ingestion run", async () => {
      let ingested: { runId: string; version: string; total: number } | undefined;
      const app = createAddressRoutes(async () =>
        makeServices({
          ingestRun: (runId, version, total) => {
            ingested = { runId, version, total };
            return Effect.void;
          },
        }),
      );
      const response = await app.fetch(
        requestWithEnv(
          "http://localhost/ingest-init",
          { NODE_ENV: "test" },
          { method: "POST", headers: { "x-admin-key": "admin-key" } },
        ),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "queued", queueMessageId: "v1" });
      expect(ingested).toEqual({ runId: "run-1", version: "v1", total: 10 });
    });
  });

  describe("rate limiting", () => {
    it("returns 429 with a Retry-After header when limited", async () => {
      const app = createAddressRoutes(async () =>
        makeServices({
          authenticateApiKey: () =>
            Effect.succeed({
              allowed: false,
              status: 429,
              message: "Rate limit exceeded",
              retryAfter: 42,
            }),
        }),
      );
      const response = await app.fetch(
        requestWithEnv(
          "http://localhost/v1/addresses/123",
          { NODE_ENV: "test" },
          {
            headers: { "x-api-key": "good-key" },
          },
        ),
      );
      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("42");
      expect(await response.json()).toEqual({ error: "Rate limit exceeded" });
    });
  });
});

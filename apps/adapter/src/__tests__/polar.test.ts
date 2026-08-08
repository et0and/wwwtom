import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { jsonResponse, requestWithEnv, testEnv } from "../test/helpers";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const polarEnv = testEnv({ POLAR_ACCESS_TOKEN: "test-token" });

describe("polar integration", () => {
  describe("GET /polar/products", () => {
    it("returns the products from the Polar API", async () => {
      const products = [{ id: "prod_1", name: "Tom's zine" }];
      fetchMock.mockResolvedValue(jsonResponse({ items: products }));
      const response = await app.fetch(requestWithEnv("http://localhost/polar/products", polarEnv));
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.polar.sh/v1/products?is_archived=false",
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
        }),
      );
      expect(await response.json()).toEqual(products);
    });

    it("maps Polar errors to a JSON error response", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: "unauthorized" }, 401));
      const response = await app.fetch(requestWithEnv("http://localhost/polar/products", polarEnv));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Failed to fetch products" });
    });
  });

  describe("GET /polar/products/:productId", () => {
    it("returns a single product", async () => {
      const product = { id: "prod_1", name: "Tom's zine" };
      fetchMock.mockResolvedValue(jsonResponse(product));
      const response = await app.fetch(
        requestWithEnv("http://localhost/polar/products/prod_1", polarEnv),
      );
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.polar.sh/v1/products/prod_1",
        expect.anything(),
      );
      expect(await response.json()).toEqual(product);
    });

    it("maps Polar errors to a JSON error response", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: "not found" }, 404));
      const response = await app.fetch(
        requestWithEnv("http://localhost/polar/products/missing", polarEnv),
      );
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Failed to fetch product" });
    });
  });

  describe("POST /polar/customers", () => {
    it("creates a customer with an external id", async () => {
      const customer = { id: "cust_1", email: "tom@example.com" };
      fetchMock.mockResolvedValue(jsonResponse(customer));
      const response = await app.fetch(
        requestWithEnv("http://localhost/polar/customers", polarEnv, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "tom@example.com", externalId: "uuid-1" }),
        }),
      );
      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.polar.sh/v1/customers/",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "tom@example.com",
            name: undefined,
            external_id: "uuid-1",
          }),
        }),
      );
      expect(await response.json()).toEqual(customer);
    });

    it("rejects a customer body without an email", async () => {
      const response = await app.fetch(
        requestWithEnv("http://localhost/polar/customers", polarEnv, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ externalId: "uuid-1" }),
        }),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Validation error" });
    });
  });
});

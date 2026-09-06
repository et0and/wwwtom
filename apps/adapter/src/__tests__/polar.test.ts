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

const fullProduct = {
  id: "prod_1",
  name: "Tom's zine",
  description: "A printed zine",
  medias: [{ id: "med_1", public_url: "https://cdn.tom.so/zine.jpg" }],
  prices: [{ price_amount: 1500, price_currency: "usd" }],
};

/** URL and body JSON of the single stubbed fetch call. */
const sentPolarRequest = async (): Promise<{
  url: string;
  body: unknown;
  init: RequestInit;
}> => {
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  const requestInit: RequestInit = init;
  const body =
    requestInit.body === undefined || requestInit.body === null
      ? undefined
      : await new Response(requestInit.body).json();
  return { url: String(url), body, init: requestInit };
};

describe("polar integration", () => {
  describe("GET /polar/products", () => {
    it("returns the products from the Polar API", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ items: [fullProduct] }));
      const response = await app.fetch(requestWithEnv("http://localhost/polar/products", polarEnv));
      expect(response.status).toBe(200);
      const sent = await sentPolarRequest();
      expect(sent.url).toBe("https://api.polar.sh/v1/products?is_archived=false");
      expect(new Headers(sent.init.headers).get("authorization")).toBe("Bearer test-token");
      expect(await response.json()).toEqual([fullProduct]);
    });

    it("maps Polar errors to RFC 9457 problem details", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: "unauthorized" }, 401));
      const response = await app.fetch(requestWithEnv("http://localhost/polar/products", polarEnv));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        type: "https://errors.tom.so/unauthorized",
        status: 401,
        title: "Failed to fetch products",
        instance: "http://localhost/polar/products",
      });
    });
  });

  describe("GET /polar/products/:productId", () => {
    it("returns a single product", async () => {
      fetchMock.mockResolvedValue(jsonResponse(fullProduct));
      const response = await app.fetch(
        requestWithEnv("http://localhost/polar/products/prod_1", polarEnv),
      );
      expect(response.status).toBe(200);
      const sent = await sentPolarRequest();
      expect(sent.url).toBe("https://api.polar.sh/v1/products/prod_1");
      expect(await response.json()).toEqual(fullProduct);
    });

    it("maps Polar errors to RFC 9457 problem details", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: "not found" }, 404));
      const response = await app.fetch(
        requestWithEnv("http://localhost/polar/products/missing", polarEnv),
      );
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        type: "https://errors.tom.so/not-found",
        status: 404,
        title: "Failed to fetch product",
        instance: "http://localhost/polar/products/missing",
      });
    });
  });

  describe("POST /polar/customers", () => {
    it("creates a customer with an external id", async () => {
      const customer = { id: "cust_1" };
      fetchMock.mockResolvedValue(jsonResponse(customer));
      const response = await app.fetch(
        requestWithEnv("http://localhost/polar/customers", polarEnv, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "tom@example.com", externalId: "uuid-1" }),
        }),
      );
      expect(response.status).toBe(200);
      const sent = await sentPolarRequest();
      expect(sent.url).toBe("https://api.polar.sh/v1/customers/");
      expect(sent.body).toEqual({
        email: "tom@example.com",
        name: undefined,
        external_id: "uuid-1",
      });
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
      const body = await response.json();
      expect(body.type).toBe("https://errors.tom.so/validation");
      expect(body.title).toBe("Validation error");
      expect(body.errors?.length).toBeGreaterThan(0);
    });
  });
});

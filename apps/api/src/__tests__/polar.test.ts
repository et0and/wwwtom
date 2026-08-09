import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const env = testEnv({ POLAR_ACCESS_TOKEN: "test-token" });

describe("polar routes", () => {
  describe("GET /checkout", () => {
    it("redirects to the Polar checkout URL with the light theme", async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ url: "https://checkout.polar.sh/session/abc" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const response = await app.fetch(
        requestWithEnv("http://localhost/checkout?products=prod_1", env),
      );
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(
        "https://checkout.polar.sh/session/abc?theme=light",
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.polar.sh/v1/checkouts/",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            products: ["prod_1"],
            successUrl: undefined,
            customerId: undefined,
            customerEmail: undefined,
          }),
        }),
      );
    });

    it("passes the customer id and success URL through", async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ url: "https://checkout.polar.sh/session/abc" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const successEnv = testEnv({
        POLAR_ACCESS_TOKEN: "test-token",
        SUCCESS_URL: "https://tom.so/thanks",
      });
      await app.fetch(
        requestWithEnv(
          "http://localhost/checkout?products=prod_1&customerId=cust_1&customerEmail=tom%40example.com",
          successEnv,
        ),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.polar.sh/v1/checkouts/",
        expect.objectContaining({
          body: JSON.stringify({
            products: ["prod_1"],
            successUrl: "https://tom.so/thanks?checkoutId={CHECKOUT_ID}",
            customerId: "cust_1",
            customerEmail: "tom@example.com",
          }),
        }),
      );
    });

    it("returns 400 when products are missing", async () => {
      const response = await app.fetch(requestWithEnv("http://localhost/checkout", env));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Validation error" });
    });

    it("returns 500 JSON when Polar fails", async () => {
      fetchMock.mockResolvedValue(new Response("unauthorized", { status: 401 }));
      const response = await app.fetch(
        requestWithEnv("http://localhost/checkout?products=prod_1", env),
      );
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ error: "Failed to create checkout" });
    });

    it("returns 500 JSON when Polar is unreachable", async () => {
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));
      const response = await app.fetch(
        requestWithEnv("http://localhost/checkout?products=prod_1", env),
      );
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ error: "Network error" });
    });
  });

  describe("GET /portal", () => {
    it("redirects to the Polar customer portal", async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ customer_portal_url: "https://polar.sh/portal/cust_1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const response = await app.fetch(
        requestWithEnv("http://localhost/portal?customerId=cust_1", env),
      );
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("https://polar.sh/portal/cust_1");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.polar.sh/v1/customer-sessions/",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ customerId: "cust_1", returnUrl: "https://tom.so/products" }),
        }),
      );
    });

    it("returns 400 when customerId is missing", async () => {
      const response = await app.fetch(requestWithEnv("http://localhost/portal", env));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Validation error" });
    });

    it("returns 500 JSON when Polar fails", async () => {
      fetchMock.mockResolvedValue(new Response("nope", { status: 403 }));
      const response = await app.fetch(
        requestWithEnv("http://localhost/portal?customerId=cust_1", env),
      );
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body).toEqual({ error: "Failed to create customer session" });
    });
  });
});

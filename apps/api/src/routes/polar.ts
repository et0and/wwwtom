import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { Checkout, CustomerPortal } from "@polar-sh/hono";
import type { Env } from "../config/effect";

export const polarRoutes = new Hono<{ Bindings: Env }>();

polarRoutes.get(
  "/checkout",
  describeRoute({
    description: "Create a checkout session and redirect to Polar",
    parameters: [
      {
        in: "query" as const,
        name: "products",
        required: true,
        schema: { type: "string" },
        description: "Product IDs to purchase (comma-separated)",
      },
      {
        in: "query" as const,
        name: "customerId",
        required: true,
        schema: { type: "string" },
        description: "Existing customer ID",
      },
      {
        in: "query" as const,
        name: "customerEmail",
        required: false,
        schema: { type: "string" },
        description: "Customer email address",
      },
    ],
    responses: {
      302: {
        description: "Redirect to Polar checkout",
      },
      400: {
        description: "Missing products and/or customerId parameter",
      },
      500: {
        description: "Failed to create checkout",
      },
    },
  }),
  async (c) =>
    Checkout({
      accessToken: c.env.POLAR_ACCESS_TOKEN,
      successUrl: c.env.SUCCESS_URL,
      server: "production",
      theme: "light",
    })(c),
);

polarRoutes.get(
  "/portal",
  describeRoute({
    description: "Redirect to Polar customer portal",
    parameters: [
      {
        in: "query" as const,
        name: "customerId",
        required: true,
        schema: { type: "string", format: "uuid" },
        description: "Polar customer ID (uuid)",
      },
    ],
    responses: {
      302: {
        description: "Redirect to Polar customer portal",
      },
      400: {
        description: "Missing customerId parameter",
      },
    },
  }),
  async (c) =>
    CustomerPortal({
      accessToken: c.env.POLAR_ACCESS_TOKEN,
      getCustomerId: async () => c.req.query("customerId") ?? "",
      returnUrl: "https://tom.so/products",
      server: "production",
    })(c),
);

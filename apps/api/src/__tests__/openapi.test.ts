import { describe, expect, it } from "vitest";
import { app } from "../index";
import { requestWithEnv, testEnv } from "../test/helpers";

describe("openapi docs", () => {
  it("serves the Scalar docs UI from the root", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/", testEnv()));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("scalar");
  });

  it("serves the OpenAPI spec", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/openapi.json", testEnv()));
    expect(response.status).toBe(200);
    const spec = await response.json();
    expect(spec.openapi).toBe("3.0.3");
    expect(spec.info.title).toBe("Tom API");
    expect(spec.servers).toContainEqual({
      url: "https://api.tom.so",
      description: "Production API service",
    });
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining([
        "/health",
        "/checkout",
        "/portal",
        "/og",
        "/challenge",
        "/request-key",
        "/ingest-init",
        "/v1/addresses",
        "/v1/addresses/{id}",
        "/v1/search",
        "/v1/reverse",
        "/v1/meta",
      ]),
    );
  });

  it("documents the address endpoints with their tags", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/openapi.json", testEnv()));
    const { paths } = await response.json();
    const searchParams = paths["/v1/search"].get.parameters as {
      name: string;
      required?: boolean;
      schema: { description?: string; anyOf?: Array<{ description?: string }> };
    }[];
    expect(paths["/v1/search"].get.tags).toEqual(["address"]);
    const qParam = searchParams.find((parameter) => parameter.name === "q");
    expect(qParam?.required).toBe(true);
    expect(qParam?.schema.description).toBe("Search query string");
    const bboxParam = searchParams.find((parameter) => parameter.name === "bbox");
    expect(bboxParam?.schema.anyOf?.[0]?.description).toBe(
      "Bounding box filter as minLng,minLat,maxLng,maxLat",
    );
    expect(paths["/challenge"].get.tags).toEqual(["address"]);
    expect(paths["/ingest-init"].post.tags).toEqual(["address"]);
  });

  it("documents the og query parameters with descriptions and examples", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/openapi.json", testEnv()));
    const { paths } = await response.json();
    const parameters = paths["/og"].get.parameters;
    expect(parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "title",
          in: "query",
          schema: expect.objectContaining({
            description: "Title text for the OG image",
            examples: ["Tom Hackshaw"],
            default: "Tom Hackshaw",
          }),
        }),
        expect.objectContaining({
          name: "summary",
          schema: expect.objectContaining({
            description: "Summary/description text for the OG image",
            examples: ["Design engineer from Aotearoa New Zealand"],
            default: "Design engineer from Aotearoa New Zealand",
          }),
        }),
        expect.objectContaining({
          name: "template",
          schema: expect.objectContaining({
            description: expect.stringContaining(
              "Available templates: default, minimal, developer",
            ),
            examples: ["default"],
          }),
        }),
      ]),
    );
  });

  it("documents responses with descriptions", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/openapi.json", testEnv()));
    const { paths } = await response.json();
    expect(paths["/og"].get.responses).toMatchObject({
      200: { description: "Generated OG image (PNG)" },
      400: { description: "Invalid query parameters" },
      500: { description: "Image generation failed" },
    });
    expect(paths["/checkout"].get.responses).toMatchObject({
      302: { description: "Redirect to Polar checkout" },
      400: { description: "Missing products and/or customerId parameter" },
      404: { description: "Product not found" },
    });
    expect(paths["/portal"].get.responses).toMatchObject({
      302: { description: "Redirect to Polar customer portal" },
      400: { description: "Missing customerId parameter" },
    });
    expect(paths["/health"].get.responses).toMatchObject({
      200: { description: "Service is healthy" },
    });
  });

  it("documents the checkout and portal parameters", async () => {
    const response = await app.fetch(requestWithEnv("http://localhost/openapi.json", testEnv()));
    const { paths } = await response.json();
    expect(paths["/checkout"].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "products",
          in: "query",
          required: true,
          schema: expect.objectContaining({
            description: "Product IDs to purchase (comma-separated)",
            examples: ["cheese-stack"],
          }),
        }),
        expect.objectContaining({
          name: "customerId",
          schema: expect.objectContaining({ description: "Existing customer ID" }),
        }),
        expect.objectContaining({
          name: "customerEmail",
          schema: expect.objectContaining({ description: "Customer email address" }),
        }),
      ]),
    );
    expect(paths["/portal"].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "customerId",
          required: true,
          schema: expect.objectContaining({
            description: "Polar customer ID (uuid)",
            format: "uuid",
          }),
        }),
      ]),
    );
  });
});

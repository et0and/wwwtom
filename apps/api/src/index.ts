import { Hono } from "hono";
import { cors } from "hono/cors";
import { Scalar } from "@scalar/hono-api-reference";
import { describeRoute, openAPIRouteHandler, resolver } from "hono-openapi";
import { ValidationError, FontFetchError, ImageGenerationError } from "@tom/types/errors";
import { Schema, Effect } from "effect";
import { ImageResponse } from "workers-og";
import {
  healthResponseSchema,
  ogImageQueryParamsSchema,
  ogImageResponseSchema,
} from "@tom/schemas";
import { OgTemplates, OgTemplateParams } from "@tom/ui";
import { requestId } from "hono/request-id";
import { Checkout, CustomerPortal } from "@polar-sh/hono";
import { logger } from "@tom/utils";

type Env = {
  POLAR_ACCESS_TOKEN: string | undefined;
  SUCCESS_URL: string | undefined;
};

const app = new Hono<{ Bindings: Env }>();

app.use("*", requestId());
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000", "https://tom.so"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    credentials: true,
  }),
);

const FONT_URL = "https://cdn.tom.so/LibreCaslonCondensed-Regular.ttf";

let cachedFontData: ArrayBuffer | null = null;

const fontFetchEffect = Effect.gen(function* () {
  if (cachedFontData !== null) {
    return cachedFontData;
  }

  const data = yield* Effect.tryPromise({
    try: () =>
      fetch(FONT_URL).then((res) => {
        return res.arrayBuffer();
      }),
    catch: (error) => {
      logger.error("Failed to fetch font");
      return new FontFetchError(
        "Failed to fetch font",
        error instanceof Error ? error.message : "Unknown error",
      );
    },
  });

  yield* Effect.sync(() => {
    cachedFontData = data;
  });

  return data;
});

function getTemplate(
  requester: string,
  templateParam?: string,
): (params: OgTemplateParams) => string {
  if (templateParam && templateParam in OgTemplates) {
    return OgTemplates[templateParam as keyof typeof OgTemplates];
  }
  switch (true) {
    case requester.includes("tom.so"):
      return OgTemplates.default;
    case requester.includes("dev.tom.so"):
      return OgTemplates.developer;
    default:
      return OgTemplates.minimal;
  }
}

const generateOgImageEffect = (
  title: string,
  summary: string,
  requester: string,
  templateParam?: string,
) =>
  Effect.gen(function* () {
    const fontData = yield* fontFetchEffect;
    const template = getTemplate(requester, templateParam);

    const html = template({ title, summary });

    return new ImageResponse(html, {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Libre Caslon Condensed",
          data: fontData,
          weight: 400,
          style: "normal",
        },
      ],
    });
  });

function runEffectWithErrorHandler<A>(
  effect: Effect.Effect<A, FontFetchError | ValidationError | ImageGenerationError>,
  onError: (error: FontFetchError | ValidationError | ImageGenerationError) => Response,
): Promise<A | Response> {
  return Effect.runPromise(Effect.catchAll(effect, (error) => Effect.succeed(onError(error))));
}

const handleOgError = (
  error: FontFetchError | ValidationError | ImageGenerationError,
): Response => {
  if (error instanceof FontFetchError) {
    return new Response(JSON.stringify({ error: error.message, cause: error.cause }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (error instanceof ValidationError) {
    return new Response(
      JSON.stringify({
        error: `Validation error: ${error.field} - ${error.issue}`,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
  return new Response(JSON.stringify({ error: error.message }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
};

app.get(
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

app.get("/products", async (c) => {
  try {
    const response = await fetch("https://api.polar.sh/v1/products?is_archived=false", {
      headers: {
        Authorization: `Bearer ${c.env.POLAR_ACCESS_TOKEN}`,
      },
    });

    if (!response.ok) {
      logger.error("Failed to fetch Polar products", {
        status: response.status,
      });
      return c.json({ error: "Failed to fetch products" }, response.status as 400 | 500);
    }

    const data = (await response.json()) as { items: unknown[] };
    return c.json(data.items);
  } catch (error) {
    logger.error("Error fetching Polar products", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.get("/products/:productId", async (c) => {
  const productId = c.req.param("productId");

  if (!productId) {
    return c.json({ error: "Product ID is required" }, 400);
  }

  try {
    const response = await fetch(`https://api.polar.sh/v1/products/${productId}`, {
      headers: {
        Authorization: `Bearer ${c.env.POLAR_ACCESS_TOKEN}`,
      },
    });

    if (!response.ok) {
      logger.error("Failed to fetch Polar product", {
        status: response.status,
      });
      return c.json({ error: "Failed to fetch product" }, response.status as 400 | 404 | 500);
    }

    const product = await response.json();
    return c.json(product);
  } catch (error) {
    logger.error("Error fetching Polar product", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.post("/customers", async (c) => {
  const body = await c.req.json();
  const { email, name, externalId } = body;

  if (!email) {
    return c.json({ error: "Email is required" }, 400);
  }

  try {
    const response = await fetch("https://api.polar.sh/v1/customers/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.POLAR_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        name,
        external_id: externalId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();

      if (response.status === 422 && errorData.includes("already exists")) {
        const listResponse = await fetch(
          `https://api.polar.sh/v1/customers?email=${encodeURIComponent(email)}`,
          {
            headers: {
              Authorization: `Bearer ${c.env.POLAR_ACCESS_TOKEN}`,
            },
          },
        );

        if (!listResponse.ok) {
          logger.error("Failed to find existing Polar customer", {
            status: listResponse.status,
          });
          return c.json({ error: "Failed to find existing customer" }, 500);
        }

        const listData = (await listResponse.json()) as { items: unknown[] };
        if (listData.items && listData.items.length > 0) {
          return c.json(listData.items[0], 200);
        }
      }

      logger.error("Failed to create Polar customer", {
        status: response.status,
        error: errorData,
      });
      return c.json(
        { error: "Failed to create customer", details: errorData },
        response.status as 400 | 422 | 500,
      );
    }

    const customer = await response.json();
    return c.json(customer, 201);
  } catch (error) {
    logger.error("Error creating Polar customer", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.get(
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

app.get(
  "/health",
  describeRoute({
    description: "Health check endpoint",
    responses: {
      200: {
        description: "Service is healthy",
        content: {
          "application/json": { schema: resolver(healthResponseSchema) },
        },
      },
    },
  }),
  (c) => {
    return c.json({ status: "healthy", timestamp: Date.now() });
  },
);

app.get(
  "/og",
  describeRoute({
    description: "OG image generation endpoint",
    parameters: [
      {
        in: "query" as const,
        name: "title",
        required: false,
        schema: { type: "string", default: "Tom Hackshaw", maxLength: 100 },
        description: "Title text for the OG image",
        example: "Tom Hackshaw",
      },
      {
        in: "query" as const,
        name: "summary",
        required: false,
        schema: {
          type: "string",
          default: "Design engineer from Aotearoa New Zealand",
          maxLength: 200,
        },
        description: "Summary/description text for the OG image",
        example: "Design engineer from Aotearoa New Zealand",
      },
      {
        in: "query" as const,
        name: "template",
        required: false,
        schema: {
          type: "string",
          enum: ["default", "minimal", "developer"],
          default: "default",
        },
        description:
          "OG image template to use. Defaults to automatic selection based on requester. Available templates: default, minimal, developer",
        example: "default",
      },
    ],
    responses: {
      200: {
        description: "Image generated successfully",
        content: {
          "application/json": { schema: resolver(ogImageResponseSchema) },
        },
      },
      400: {
        description: "Invalid query parameters",
      },
      500: {
        description: "Image generation failed",
      },
    },
  }),
  async (c) => {
    const title = c.req.query("title") || "Tom Hackshaw";
    const summary = c.req.query("summary") || "Design engineer from Aotearoa New Zealand";
    const template = c.req.query("template") || undefined;
    const referer = c.req.header("Referer") || "";
    const requester = referer || c.req.query("requester") || "unknown";

    const validationResult = await Effect.runPromise(
      Schema.decode(ogImageQueryParamsSchema)({ title, summary }),
    );

    const result = await runEffectWithErrorHandler(
      generateOgImageEffect(title, summary, requester, template),
      handleOgError,
    );

    if (result instanceof Response) {
      return result;
    }

    return result;
  },
);

app.get(
  "/openapi",
  openAPIRouteHandler(app, {
    documentation: {
      info: {
        title: "Tom API",
        version: "0.0.1",
        description: "A multi faceted API service",
      },
      servers: [
        {
          url: "https://api.tom.so",
          description: "Production API service",
        },
        {
          url: "https://staging.api.tom.so",
          description: "Staging API service, pre-prod",
        },
        {
          url: "https://dev.api.tom.so",
          description: "Development API service, unstable",
        },
      ],
    },
  }),
);

app.get(
  "/",
  Scalar({
    url: "/openapi",
    theme: "elysiajs",
    pageTitle: "Tom API",
    favicon: "https://tom.so/favicon.ico",
  }),
);

export default app;

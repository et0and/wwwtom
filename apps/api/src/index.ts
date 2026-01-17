import { Hono } from "hono";
import { cors } from "hono/cors";
import { Scalar } from "@scalar/hono-api-reference";
import { describeRoute, openAPIRouteHandler, resolver } from "hono-openapi";
import { Effect, Schema } from "effect";
import { ImageResponse } from "workers-og";
import {
  healthResponseSchema,
  ogImageQueryParamsSchema,
  ogImageResponseSchema,
} from "@tom/schemas";
import { OgTemplates, OgTemplateParams } from "@tom/ui";
import { requestId } from "hono/request-id";
import { Checkout, CustomerPortal } from "@polar-sh/hono";
import { logger, runServerEffect } from "@tom/utils";
import { FontFetchError, ValidationError, ImageGenerationError, PolarApiError } from "@tom/types";
import { HttpStatus } from "@tom/constants";

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
  logger.info("Fetching font");
  if (cachedFontData !== null) {
    logger.info("Pulling cached font files");
    return cachedFontData;
  }

  const data = yield* Effect.tryPromise({
    try: () =>
      fetch(FONT_URL).then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch font: ${res.status}`);
        }
        return res.arrayBuffer();
      }),
    catch: (error) =>
      new FontFetchError(
        "Failed to fetch font",
        error instanceof Error ? error.message : "Unknown error",
      ),
  });

  cachedFontData = data;

  return data;
});

const getTemplate = (
  requester: string,
  templateParam?: string,
): ((params: OgTemplateParams) => string) => {
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
};

const generateOgImageEffect = (
  title: string,
  summary: string,
  requester: string,
  templateParam?: string,
) =>
  Effect.gen(function* () {
    logger.info("Generating OG image");
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

const fetchPolarProducts = (
  accessToken: string | undefined,
): Effect.Effect<unknown[], PolarApiError> =>
  Effect.gen(function* () {
    logger.info("Fetching products from Polar API");
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch("https://api.polar.sh/v1/products?is_archived=false", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      catch: () =>
        new PolarApiError({
          message: "Network error",
          status: 0,
          operation: "fetch_products",
        }),
    });

    if (!response.ok) {
      logger.error("Failed to fetch Polar products", {
        status: response.status,
      });
      return yield* Effect.fail(
        new PolarApiError({
          message: "Failed to fetch products",
          status: response.status,
          operation: "fetch_products",
        }),
      );
    }

    return yield* Effect.tryPromise({
      try: () => response.json() as Promise<{ items: unknown[] }>,
      catch: () =>
        new PolarApiError({
          message: "Failed to parse response",
          status: HttpStatus.InternalServerError,
          operation: "fetch_products",
        }),
    }).pipe(Effect.map((data) => data.items));
  });

const fetchPolarProduct = (
  productId: string,
  accessToken: string | undefined,
): Effect.Effect<unknown, PolarApiError> =>
  Effect.gen(function* () {
    logger.info(`Fetching product ${productId} from Polar API`);
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(`https://api.polar.sh/v1/products/${productId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      catch: () =>
        new PolarApiError({
          message: "Network error",
          status: 0,
          operation: "fetch_product",
        }),
    });

    if (!response.ok) {
      logger.error(`Failed to fetch Polar product ${productId}`, {
        status: response.status,
      });
      return yield* Effect.fail(
        new PolarApiError({
          message: "Failed to fetch product",
          status: response.status,
          operation: "fetch_product",
        }),
      );
    }

    return yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () =>
        new PolarApiError({
          message: "Failed to parse response",
          status: HttpStatus.InternalServerError,
          operation: "fetch_product",
        }),
    });
  });

const createPolarCustomer = (
  email: string,
  name: string | undefined,
  externalId: string | undefined,
  accessToken: string | undefined,
): Effect.Effect<unknown, PolarApiError> =>
  Effect.gen(function* () {
    logger.info("Customer doesn't exist in Polar, creating now");
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch("https://api.polar.sh/v1/customers/", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            name,
            external_id: externalId,
          }),
        }),
      catch: () =>
        new PolarApiError({
          message: "Network error",
          status: 0,
          operation: "create_customer",
        }),
    });

    if (!response.ok) {
      const errorData = yield* Effect.tryPromise({
        try: () => response.text(),
        catch: () =>
          new PolarApiError({
            message: "Failed to read error response",
            status: response.status,
            operation: "create_customer",
          }),
      });

      if (
        response.status === HttpStatus.UnprocessableEntity &&
        errorData.includes("already exists")
      ) {
        logger.info("Customer already exists in Polar, fetching details");
        const listResponse = yield* Effect.tryPromise({
          try: () =>
            fetch(`https://api.polar.sh/v1/customers?email=${encodeURIComponent(email)}`, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }),
          catch: () =>
            new PolarApiError({
              message: "Network error",
              status: 0,
              operation: "find_customer",
            }),
        });

        if (!listResponse.ok) {
          logger.error(`Failed to find existing Polar customer with email ${email}`, {
            status: listResponse.status,
          });
          return yield* Effect.fail(
            new PolarApiError({
              message: "Failed to find existing customer",
              status: listResponse.status,
              operation: "find_customer",
            }),
          );
        }

        const listData = yield* Effect.tryPromise({
          try: () => listResponse.json() as Promise<{ items: unknown[] }>,
          catch: () =>
            new PolarApiError({
              message: "Failed to parse response",
              status: HttpStatus.InternalServerError,
              operation: "find_customer",
            }),
        });

        if (listData.items && listData.items.length > 0) {
          return listData.items[0];
        }
      }

      logger.error("Failed to create Polar customer", {
        status: response.status,
        error: errorData,
      });
      return yield* Effect.fail(
        new PolarApiError({
          message: `Failed to create customer: ${errorData}`,
          status: response.status,
          operation: "create_customer",
        }),
      );
    }

    return yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () =>
        new PolarApiError({
          message: "Failed to parse response",
          status: HttpStatus.InternalServerError,
          operation: "create_customer",
        }),
    });
  });

const handlePolarError = (error: PolarApiError): Response => {
  return new Response(JSON.stringify({ error: error.message }), {
    status: error.status as
      | HttpStatus.BadGateway
      | HttpStatus.NotFound
      | HttpStatus.InternalServerError,
    headers: { "Content-Type": "application/json" },
  });
};

const handleOgError = (
  error: FontFetchError | ValidationError | ImageGenerationError,
): Response => {
  if (error instanceof FontFetchError) {
    return new Response(JSON.stringify({ error: error.message, cause: error.cause }), {
      status: HttpStatus.BadGateway,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (error instanceof ValidationError) {
    return new Response(
      JSON.stringify({
        error: `Validation error: ${error.field} - ${error.issue}`,
      }),
      {
        status: HttpStatus.BadRequest,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
  return new Response(JSON.stringify({ error: error.message }), {
    status: HttpStatus.InternalServerError,
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
  const result = await runServerEffect(
    fetchPolarProducts(c.env.POLAR_ACCESS_TOKEN).pipe(
      Effect.catchAll((error) => {
        logger.error("Error fetching Polar products", error);
        return Effect.succeed(handlePolarError(error));
      }),
    ),
  );

  if (result instanceof Response) {
    return result;
  }

  return c.json(result);
});

app.get("/products/:productId", async (c) => {
  const productId = c.req.param("productId");

  if (!productId) {
    return c.json({ error: "Product ID is required" }, HttpStatus.BadRequest);
  }

  const result = await runServerEffect(
    fetchPolarProduct(productId, c.env.POLAR_ACCESS_TOKEN).pipe(
      Effect.catchAll((error) => {
        logger.error("Error fetching Polar product", error);
        return Effect.succeed(handlePolarError(error));
      }),
    ),
  );

  if (result instanceof Response) {
    return result;
  }

  return c.json(result);
});

app.post("/customers", async (c) => {
  const body = await c.req.json();
  const { email, name, externalId } = body;

  if (!email) {
    return c.json({ error: "Email is required" }, HttpStatus.BadRequest);
  }

  const result = await runServerEffect(
    createPolarCustomer(email, name, externalId, c.env.POLAR_ACCESS_TOKEN).pipe(
      Effect.mapError((error) => {
        logger.error("Error creating Polar customer", error);
        return error;
      }),
    ),
  );

  if (result instanceof Response) {
    return result;
  }

  return c.json(result, HttpStatus.Created);
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

    const result = await runServerEffect(
      Effect.gen(function* () {
        const validation = yield* Schema.decode(ogImageQueryParamsSchema)({
          title,
          summary,
        });
        return yield* generateOgImageEffect(title, summary, requester, template);
      }).pipe(
        Effect.catchTag("ParseError", (error) =>
          Effect.fail(
            new ValidationError({
              field: "params",
              issue: error.message || "Invalid query parameters",
            }),
          ),
        ),
        Effect.catchAll((error) => {
          logger.error("Error generating OG image", error);
          return Effect.succeed(handleOgError(error));
        }),
      ),
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

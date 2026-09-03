import { Elysia } from "elysia";
import { Effect, Option, Schema } from "effect";
import { HttpStatus } from "@tom/constants/http";
import { problemDetailsSchema } from "@tom/schemas/error";
import { PolarApiError } from "@tom/types/errors";
import {
  errorDetailsFromRequest,
  getRequestEnv,
  logApiFailure,
  logContextFromRequest,
  runEffect,
  sendErrorAlert,
} from "@tom/utils/services/worker";
import type { ErrorAlertDetails } from "@tom/schemas/telegram";
import type { CloudflareEnv } from "@tom/utils/services/config";
import { toOpenApiSchema } from "../openapi";
import {
  createPolarCheckout,
  createPolarCustomerSession,
  handlePolarError,
} from "../services/polar";

const productsSchema = Schema.String.pipe(
  Schema.annotate({
    description: "Product IDs to purchase (comma-separated)",
    examples: ["cheese-stack"],
  }),
);

const customerIdSchema = Schema.optional(Schema.String).pipe(
  Schema.annotate({ description: "Existing customer ID", examples: ["cus_123"] }),
);

const customerEmailSchema = Schema.optional(Schema.String).pipe(
  Schema.annotate({
    description: "Customer email address",
    examples: ["tom@tom.so"],
  }),
);

const CheckoutQuerySchema = Schema.Struct({
  products: productsSchema,
  customerId: customerIdSchema,
  customerEmail: customerEmailSchema,
});

const checkoutQuerySchema = toOpenApiSchema(CheckoutQuerySchema);

const portalCustomerIdSchema = Schema.String.pipe(
  Schema.annotate({ description: "Polar customer ID (uuid)", format: "uuid" }),
);

const PortalQuerySchema = Schema.Struct({ customerId: portalCustomerIdSchema });

const portalQuerySchema = toOpenApiSchema(PortalQuerySchema);

const redirectSchema = (description: string) =>
  Schema.String.pipe(Schema.annotate({ description }));

const missingCustomerSchema = problemDetailsSchema.pipe(
  Schema.annotate({ description: "Missing products and/or customerId parameter" }),
);

const missingPortalSchema = problemDetailsSchema.pipe(
  Schema.annotate({ description: "Missing customerId parameter" }),
);

const checkoutFailedSchema = problemDetailsSchema.pipe(
  Schema.annotate({ description: "Failed to create checkout" }),
);

const productNotFoundSchema = problemDetailsSchema.pipe(
  Schema.annotate({ description: "Product not found" }),
);

const withErrorHandling = (
  effect: Effect.Effect<Response, PolarApiError>,
  errorMessage: string,
  env: CloudflareEnv,
  details: ErrorAlertDetails,
) =>
  effect.pipe(
    Effect.catch((error) =>
      Effect.gen(function* () {
        yield* logApiFailure(errorMessage, error.status, error);
        if (
          error.status < HttpStatus.BadRequest ||
          error.status >= HttpStatus.InternalServerError
        ) {
          yield* Effect.sync(() => {
            sendErrorAlert(env, errorMessage, error, details);
          });
        }
        return yield* Effect.succeed(handlePolarError(error));
      }),
    ),
  );

export const polarRoutes = new Elysia({ name: "polar" })
  .get(
    "/checkout",
    async ({ query, request }) => {
      const env = getRequestEnv(request);
      const successUrl = env.SUCCESS_URL
        ? `${env.SUCCESS_URL}?checkoutId={CHECKOUT_ID}`
        : undefined;
      const products = (query.products ?? "").split(",").filter(Boolean);

      const result = await runEffect(
        withErrorHandling(
          createPolarCheckout(env.POLAR_ACCESS_TOKEN, env.POLAR_API_URL ?? "https://api.polar.sh", {
            products,
            successUrl,
            customerId: query.customerId,
            customerEmail: query.customerEmail,
          }).pipe(
            Effect.flatMap((data) =>
              Option.match(Schema.decodeUnknownOption(Schema.URLFromString)(data.url), {
                onNone: () =>
                  Effect.fail(
                    new PolarApiError({
                      message: "Polar returned an invalid checkout URL",
                      status: HttpStatus.BadGateway,
                      operation: "checkout",
                    }),
                  ),
                onSome: (redirectUrl) =>
                  Effect.sync(() => {
                    redirectUrl.searchParams.set("theme", "light");
                    return Response.redirect(redirectUrl.toString(), HttpStatus.Found);
                  }),
              }),
            ),
          ),
          "Error creating Polar checkout",
          env,
          errorDetailsFromRequest(request, { service: "tom-api" }),
        ),
        logContextFromRequest(request, "tom-api"),
      );

      return result;
    },
    {
      query: checkoutQuerySchema,
      response: {
        302: toOpenApiSchema(redirectSchema("Redirect to Polar checkout")),
        400: toOpenApiSchema(missingCustomerSchema),
        404: toOpenApiSchema(productNotFoundSchema),
        500: toOpenApiSchema(checkoutFailedSchema),
      },
      detail: {
        description: "Create a checkout session and redirect to Polar",
        tags: ["polar"],
        security: [{ InternalToken: [] }],
      },
    },
  )
  .get(
    "/portal",
    async ({ query, request }) => {
      const env = getRequestEnv(request);

      const result = await runEffect(
        withErrorHandling(
          createPolarCustomerSession(
            env.POLAR_ACCESS_TOKEN,
            env.POLAR_API_URL ?? "https://api.polar.sh",
            { customerId: query.customerId ?? "", returnUrl: "https://tom.so/products" },
          ).pipe(
            Effect.map((data) => Response.redirect(data.customer_portal_url, HttpStatus.Found)),
          ),
          "Error creating Polar customer session",
          env,
          errorDetailsFromRequest(request, { service: "tom-api" }),
        ),
        logContextFromRequest(request, "tom-api"),
      );

      return result;
    },
    {
      query: portalQuerySchema,
      response: {
        302: toOpenApiSchema(redirectSchema("Redirect to Polar customer portal")),
        400: toOpenApiSchema(missingPortalSchema),
        500: toOpenApiSchema(checkoutFailedSchema),
      },
      detail: {
        description: "Redirect to Polar customer portal",
        tags: ["polar"],
        security: [{ InternalToken: [] }],
      },
    },
  );

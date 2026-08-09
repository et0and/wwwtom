import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { HttpStatus } from "@tom/constants";
import { errorResponseSchema } from "@tom/schemas/error";
import { getRequestEnv, runEffect, toErrorResponse, toErrorMessage } from "@tom/utils/services";
import { createPolarCheckout, createPolarCustomerSession } from "../services/polar";

const CheckoutQuerySchema = Schema.Struct({
  products: Schema.String,
  customerId: Schema.optional(Schema.String),
  customerEmail: Schema.optional(Schema.String),
});

const checkoutQuerySchema = Schema.toStandardSchemaV1(CheckoutQuerySchema);

const PortalQuerySchema = Schema.Struct({ customerId: Schema.String });

const portalQuerySchema = Schema.toStandardSchemaV1(PortalQuerySchema);

const withErrorHandling = (effect: Effect.Effect<Response, unknown>, errorMessage: string) =>
  effect.pipe(
    Effect.catch((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(errorMessage, error);
        return yield* Effect.succeed(
          toErrorResponse(HttpStatus.InternalServerError, toErrorMessage(error)),
        );
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
      const products = query.products.split(",").filter(Boolean);

      const result = await runEffect(
        withErrorHandling(
          createPolarCheckout(env.POLAR_ACCESS_TOKEN, env.POLAR_API_URL ?? "https://api.polar.sh", {
            products,
            successUrl,
            customerId: query.customerId,
            customerEmail: query.customerEmail,
          }).pipe(
            Effect.map((data) => {
              const redirectUrl = new URL(data.url);
              redirectUrl.searchParams.set("theme", "light");
              return Response.redirect(redirectUrl.toString(), HttpStatus.Found);
            }),
          ),
          "Error creating Polar checkout",
        ),
      );

      return result;
    },
    {
      query: checkoutQuerySchema,
      response: {
        302: Schema.toStandardSchemaV1(Schema.Unknown),
        400: Schema.toStandardSchemaV1(errorResponseSchema),
        500: Schema.toStandardSchemaV1(errorResponseSchema),
      },
      detail: {
        description: "Create a checkout session and redirect to Polar",
        tags: ["polar"],
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
            { customerId: query.customerId, returnUrl: "https://tom.so/products" },
          ).pipe(
            Effect.map((data) => Response.redirect(data.customer_portal_url, HttpStatus.Found)),
          ),
          "Error creating Polar customer session",
        ),
      );

      return result;
    },
    {
      query: portalQuerySchema,
      response: {
        302: Schema.toStandardSchemaV1(Schema.Unknown),
        400: Schema.toStandardSchemaV1(errorResponseSchema),
        500: Schema.toStandardSchemaV1(errorResponseSchema),
      },
      detail: {
        description: "Redirect to Polar customer portal",
        tags: ["polar"],
      },
    },
  );

import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { PolarApiError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import type { Customer, CustomerInput } from "@tom/types/customer";
import type { Product } from "@tom/types/product";
import { callApi } from "../../callApi";
import { customerBodySchema } from "../../schemas";
import {
  getRequestEnv,
  logApiFailure,
  logContextFromRequest,
  runEffect,
  toErrorResponse,
} from "@tom/utils/services/worker";
import { readCloudflareEnv, type CloudflareEnv } from "@tom/utils/services/config";
import type { LogContext } from "@tom/utils/services/logging";
import { AdapterError, runAdapter } from "../../config/effect";
import { simulatorEnv } from "../../simulator";

const authHeaders = (accessToken: string | undefined) => ({
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
});

const parseJson = <T>(response: Response, operation: string): Effect.Effect<T, PolarApiError> =>
  Effect.tryPromise({
    try: () => response.json() as Promise<T>,
    catch: () =>
      new PolarApiError({
        message: "Failed to parse response",
        status: HttpStatus.InternalServerError,
        operation,
      }),
  });

const polarBaseUrl = (env: CloudflareEnv) => env.POLAR_API_URL ?? "https://api.polar.sh";

const fetchPolarProducts = (env: CloudflareEnv): Effect.Effect<Product[], PolarApiError> =>
  Effect.gen(function* () {
    yield* Effect.logInfo("Fetching products from Polar API");
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(`${polarBaseUrl(env)}/v1/products?is_archived=false`, {
          headers: authHeaders(env.POLAR_ACCESS_TOKEN),
        }),
      catch: () =>
        new PolarApiError({
          message: "Network error",
          status: 0,
          operation: "fetch_products",
        }),
    });

    if (!response.ok) {
      yield* logApiFailure("Failed to fetch Polar products", response.status);
      return yield* new PolarApiError({
        message: "Failed to fetch products",
        status: response.status,
        operation: "fetch_products",
      });
    }

    const data = yield* parseJson<{ items: Product[] }>(response, "fetch_products");
    return data.items;
  });

const fetchPolarProduct = (
  env: CloudflareEnv,
  productId: string,
): Effect.Effect<Product, PolarApiError> =>
  Effect.gen(function* () {
    yield* Effect.logInfo(`Fetching product ${productId} from Polar API`);
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(`${polarBaseUrl(env)}/v1/products/${productId}`, {
          headers: authHeaders(env.POLAR_ACCESS_TOKEN),
        }),
      catch: () =>
        new PolarApiError({
          message: "Network error",
          status: 0,
          operation: "fetch_product",
        }),
    });

    if (!response.ok) {
      yield* logApiFailure(`Failed to fetch Polar product ${productId}`, response.status);
      return yield* new PolarApiError({
        message: "Failed to fetch product",
        status: response.status,
        operation: "fetch_product",
      });
    }

    return yield* parseJson<Product>(response, "fetch_product");
  });

const createPolarCustomer = (
  env: CloudflareEnv,
  input: CustomerInput,
): Effect.Effect<Customer, PolarApiError> =>
  Effect.gen(function* () {
    yield* Effect.logInfo("Creating Polar customer");
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(`${polarBaseUrl(env)}/v1/customers/`, {
          method: "POST",
          headers: authHeaders(env.POLAR_ACCESS_TOKEN),
          body: JSON.stringify({
            email: input.email,
            name: input.name,
            external_id: input.externalId,
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
        yield* Effect.logInfo("Customer already exists in Polar, fetching details");
        const listResponse = yield* Effect.tryPromise({
          try: () =>
            fetch(`${polarBaseUrl(env)}/v1/customers?email=${encodeURIComponent(input.email)}`, {
              headers: authHeaders(env.POLAR_ACCESS_TOKEN),
            }),
          catch: () =>
            new PolarApiError({
              message: "Network error",
              status: 0,
              operation: "find_customer",
            }),
        });

        if (!listResponse.ok) {
          yield* logApiFailure("Failed to find existing Polar customer", listResponse.status);
          return yield* new PolarApiError({
            message: "Failed to find existing customer",
            status: listResponse.status,
            operation: "find_customer",
          });
        }

        const listData = yield* parseJson<{ items: Customer[] }>(listResponse, "find_customer");
        const existing = listData.items[0];
        if (existing) {
          return existing;
        }
      }

      yield* logApiFailure("Failed to create Polar customer", response.status, errorData);
      return yield* new PolarApiError({
        message: `Failed to create customer: ${errorData}`,
        status: response.status,
        operation: "create_customer",
      });
    }

    return yield* parseJson<Customer>(response, "create_customer");
  });

const runPolar = <T>(effect: Effect.Effect<T, PolarApiError>, context: LogContext): Promise<T> =>
  runAdapter(
    effect,
    (error) => new AdapterError(error.status || HttpStatus.InternalServerError, error.message),
    context,
  );

type EdenResult = { error?: unknown; response: Response };

const proxyToApi = (
  call: Promise<EdenResult>,
  errorMessage: string,
  context: LogContext,
): Promise<Response> =>
  runEffect(
    Effect.tryPromise(() => call).pipe(
      Effect.map((result) => {
        const upstream = result.response;
        // The API's checkout/portal handlers redirect (302) to Polar. Return a
        // fresh redirect (returning the upstream undici Response directly is
        // dropped by Elysia), so the browser follows it. callApi uses manual
        // redirects so the upstream Response's Location is preserved.
        // Everything else is an upstream failure — wrap it.
        if (upstream && upstream.status >= 300 && upstream.status < HttpStatus.BadRequest) {
          const location = upstream.headers.get("location");
          if (location) return Response.redirect(location, upstream.status);
        }
        return toErrorResponse(HttpStatus.InternalServerError, errorMessage);
      }),
    ),
    context,
  );

const CheckoutQuerySchema = Schema.Struct({
  products: Schema.String,
  customerId: Schema.optional(Schema.String),
  customerEmail: Schema.optional(Schema.String),
});

const checkoutQuerySchema = Schema.toStandardSchemaV1(CheckoutQuerySchema);

const PortalQuerySchema = Schema.Struct({ customerId: Schema.String });

const portalQuerySchema = Schema.toStandardSchemaV1(PortalQuerySchema);

const ProductIdParamsSchema = Schema.toStandardSchemaV1(
  Schema.Struct({ productId: Schema.String }),
);

export const polarIntegration = new Elysia({ name: "polar" })
  .get(
    "/polar/products",
    ({ request }) => {
      const env = simulatorEnv(getRequestEnv(request), request);
      return runPolar(fetchPolarProducts(env), logContextFromRequest(request, "tom-adapter"));
    },
    {
      detail: { description: "List purchasable Polar products", tags: ["polar"] },
    },
  )
  .get(
    "/polar/products/:productId",
    ({ params, request }) => {
      const env = simulatorEnv(getRequestEnv(request), request);
      return runPolar(
        fetchPolarProduct(env, params.productId),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      params: ProductIdParamsSchema,
      detail: { description: "Get a Polar product", tags: ["polar"] },
    },
  )
  .post(
    "/polar/customers",
    ({ body, request }) => {
      const env = simulatorEnv(getRequestEnv(request), request);
      return runPolar(
        createPolarCustomer(env, body),
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      body: customerBodySchema,
      detail: {
        description: "Create a Polar customer (or fetch the existing one)",
        tags: ["polar"],
      },
    },
  )
  .get(
    "/polar/checkout",
    async ({ query, request }) => {
      const env = simulatorEnv(await readCloudflareEnv(getRequestEnv(request)), request);
      const api = callApi(env.API_URL ?? "http://localhost:8787", env.INTERNAL_API_TOKEN);
      return proxyToApi(
        api.checkout.get({
          query: {
            products: query.products,
            ...(query.customerId && { customerId: query.customerId }),
            ...(query.customerEmail && { customerEmail: query.customerEmail }),
          },
        }),
        "Failed to create checkout",
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      query: checkoutQuerySchema,
      detail: {
        description: "Redirect to Polar checkout (proxied to the Tom API)",
        tags: ["polar"],
      },
    },
  )
  .get(
    "/polar/portal",
    async ({ query, request }) => {
      const env = simulatorEnv(await readCloudflareEnv(getRequestEnv(request)), request);
      const api = callApi(env.API_URL ?? "http://localhost:8787", env.INTERNAL_API_TOKEN);
      return proxyToApi(
        api.portal.get({ query: { customerId: query.customerId } }),
        "Failed to open customer portal",
        logContextFromRequest(request, "tom-adapter"),
      );
    },
    {
      query: portalQuerySchema,
      detail: {
        description: "Redirect to Polar customer portal (proxied to the Tom API)",
        tags: ["polar"],
      },
    },
  );

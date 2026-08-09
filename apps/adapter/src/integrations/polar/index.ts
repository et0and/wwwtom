import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { PolarApiError } from "@tom/types";
import { HttpStatus } from "@tom/constants";
import type { Product, Customer, CustomerInput } from "@tom/types";
import { callApi } from "../../callApi";
import { customerBodySchema } from "../../schemas";
import { getRequestEnv, runEffect, toErrorResponse } from "@tom/utils/services";
import type { CloudflareEnv } from "@tom/utils/services";
import { AdapterError, runAdapter } from "../../config/effect";

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
      yield* Effect.logError("Failed to fetch Polar products", { status: response.status });
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
      yield* Effect.logError(`Failed to fetch Polar product ${productId}`, {
        status: response.status,
      });
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
          yield* Effect.logError("Failed to find existing Polar customer", {
            status: listResponse.status,
          });
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

      yield* Effect.logError("Failed to create Polar customer", {
        status: response.status,
        error: errorData,
      });
      return yield* new PolarApiError({
        message: `Failed to create customer: ${errorData}`,
        status: response.status,
        operation: "create_customer",
      });
    }

    return yield* parseJson<Customer>(response, "create_customer");
  });

const runPolar = <T>(effect: Effect.Effect<T, PolarApiError>): Promise<T> =>
  runAdapter(
    effect,
    (error) => new AdapterError(error.status || HttpStatus.InternalServerError, error.message),
  );

type EdenResult = { error?: unknown; response: Response };

const proxyToApi = (call: Promise<EdenResult>, errorMessage: string): Promise<Response> =>
  runEffect(
    Effect.tryPromise(() => call).pipe(
      Effect.map((result) =>
        result.error
          ? toErrorResponse(HttpStatus.InternalServerError, errorMessage)
          : result.response,
      ),
    ),
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
      const env = getRequestEnv(request);
      return runPolar(fetchPolarProducts(env));
    },
    {
      detail: { description: "List purchasable Polar products", tags: ["polar"] },
    },
  )
  .get(
    "/polar/products/:productId",
    ({ params, request }) => {
      const env = getRequestEnv(request);
      return runPolar(fetchPolarProduct(env, params.productId));
    },
    {
      params: ProductIdParamsSchema,
      detail: { description: "Get a Polar product", tags: ["polar"] },
    },
  )
  .post(
    "/polar/customers",
    ({ body, request }) => {
      const env = getRequestEnv(request);
      return runPolar(createPolarCustomer(env, body));
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
    ({ query, request }) => {
      const env = getRequestEnv(request);
      const api = callApi(env.API_URL ?? "http://localhost:8787");
      return proxyToApi(
        api.checkout.get({
          query: {
            products: query.products,
            ...(query.customerId ? { customerId: query.customerId } : {}),
            ...(query.customerEmail ? { customerEmail: query.customerEmail } : {}),
          },
        }),
        "Failed to create checkout",
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
    ({ query, request }) => {
      const env = getRequestEnv(request);
      const api = callApi(env.API_URL ?? "http://localhost:8787");
      return proxyToApi(
        api.portal.get({ query: { customerId: query.customerId } }),
        "Failed to open customer portal",
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

import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { Headers, HttpBody, HttpClient, HttpClientResponse } from "effect/unstable/http";
import { PolarApiError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import type { Customer, CustomerInput } from "@tom/types/customer";
import type { Product } from "@tom/types/product";
import {
  polarCustomerSchema,
  polarCustomersResponseSchema,
  polarProductSchema,
  polarProductsResponseSchema,
} from "@tom/schemas/polar";
import { callApi } from "../../callApi";
import { customerBodySchema } from "../../schemas";
import {
  getRequestEnv,
  logApiFailure,
  logContextFromRequest,
  runEffect,
  toProblemResponse,
} from "@tom/utils/services/worker";
import { readCloudflareEnv, type CloudflareEnv } from "@tom/utils/services/config";
import type { LogContext } from "@tom/utils/services/logging";
import { AdapterError, runAdapter } from "../../config/effect";
import { simulatorEnv } from "../../simulator";
import { liveHttpClient } from "../../http-client";

const authHeaders = (accessToken: string | undefined) =>
  Headers.fromInput({
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  });

const polarBaseUrl = (env: CloudflareEnv) => env.POLAR_API_URL ?? "https://api.polar.sh";

const networkError = (operation: string) =>
  new PolarApiError({ message: "Network error", status: 0, operation });

const parseError = (operation: string) =>
  new PolarApiError({
    message: "Failed to parse response",
    status: HttpStatus.InternalServerError,
    operation,
  });

const fetchPolarProducts = (
  env: CloudflareEnv,
): Effect.Effect<ReadonlyArray<Product>, PolarApiError> =>
  Effect.gen(function* () {
    yield* Effect.logInfo("Fetching products from Polar API");
    const client = yield* HttpClient.HttpClient;
    const response = yield* client
      .get(`${polarBaseUrl(env)}/v1/products?is_archived=false`, {
        headers: authHeaders(env.POLAR_ACCESS_TOKEN),
      })
      .pipe(Effect.mapError(() => networkError("fetch_products")));

    const okResponse = yield* HttpClientResponse.filterStatusOk(response).pipe(
      Effect.tapError((error) =>
        logApiFailure(
          "Failed to fetch Polar products",
          error.response?.status ?? HttpStatus.InternalServerError,
        ),
      ),
      Effect.mapError(
        (error) =>
          new PolarApiError({
            message: "Failed to fetch products",
            status: error.response?.status ?? HttpStatus.InternalServerError,
            operation: "fetch_products",
          }),
      ),
    );

    const data = yield* HttpClientResponse.schemaBodyJson(polarProductsResponseSchema)(
      okResponse,
    ).pipe(Effect.mapError(() => parseError("fetch_products")));
    return data.items;
  }).pipe(Effect.provide(liveHttpClient()));

const fetchPolarProduct = (
  env: CloudflareEnv,
  productId: string,
): Effect.Effect<Product, PolarApiError> =>
  Effect.gen(function* () {
    yield* Effect.logInfo(`Fetching product ${productId} from Polar API`);
    const client = yield* HttpClient.HttpClient;
    const response = yield* client
      .get(`${polarBaseUrl(env)}/v1/products/${productId}`, {
        headers: authHeaders(env.POLAR_ACCESS_TOKEN),
      })
      .pipe(Effect.mapError(() => networkError("fetch_product")));

    const okResponse = yield* HttpClientResponse.filterStatusOk(response).pipe(
      Effect.tapError((error) =>
        logApiFailure(
          `Failed to fetch Polar product ${productId}`,
          error.response?.status ?? HttpStatus.InternalServerError,
        ),
      ),
      Effect.mapError(
        (error) =>
          new PolarApiError({
            message: "Failed to fetch product",
            status: error.response?.status ?? HttpStatus.InternalServerError,
            operation: "fetch_product",
          }),
      ),
    );

    return yield* HttpClientResponse.schemaBodyJson(polarProductSchema)(okResponse).pipe(
      Effect.mapError(() => parseError("fetch_product")),
    );
  }).pipe(Effect.provide(liveHttpClient()));

const findExistingCustomer = (
  client: HttpClient.HttpClient,
  env: CloudflareEnv,
  email: string,
): Effect.Effect<Customer | undefined, PolarApiError> =>
  Effect.gen(function* () {
    const response = yield* client
      .get(`${polarBaseUrl(env)}/v1/customers?email=${encodeURIComponent(email)}`, {
        headers: authHeaders(env.POLAR_ACCESS_TOKEN),
      })
      .pipe(Effect.mapError(() => networkError("find_customer")));

    const okResponse = yield* HttpClientResponse.filterStatusOk(response).pipe(
      Effect.tapError((error) =>
        logApiFailure(
          "Failed to find existing Polar customer",
          error.response?.status ?? HttpStatus.InternalServerError,
        ),
      ),
      Effect.mapError(
        (error) =>
          new PolarApiError({
            message: "Failed to find existing customer",
            status: error.response?.status ?? HttpStatus.InternalServerError,
            operation: "find_customer",
          }),
      ),
    );

    const listData = yield* HttpClientResponse.schemaBodyJson(polarCustomersResponseSchema)(
      okResponse,
    ).pipe(Effect.mapError(() => parseError("find_customer")));
    return listData.items[0];
  });

const handleCreateError = (
  response: HttpClientResponse.HttpClientResponse,
  client: HttpClient.HttpClient,
  env: CloudflareEnv,
  email: string,
): Effect.Effect<Customer, PolarApiError> =>
  Effect.gen(function* () {
    const status = response.status;
    const errorData = yield* response.text.pipe(
      Effect.mapError(
        () =>
          new PolarApiError({
            message: "Failed to read error response",
            status,
            operation: "create_customer",
          }),
      ),
    );

    if (status === HttpStatus.UnprocessableEntity && errorData.includes("already exists")) {
      yield* Effect.logInfo("Customer already exists in Polar, fetching details");
      const existing = yield* findExistingCustomer(client, env, email);
      if (existing) return existing;
    }

    yield* logApiFailure("Failed to create Polar customer", status, errorData);
    return yield* new PolarApiError({
      message: `Failed to create customer: ${errorData}`,
      status,
      operation: "create_customer",
    });
  });

const createPolarCustomer = (
  env: CloudflareEnv,
  input: CustomerInput,
): Effect.Effect<Customer, PolarApiError> =>
  Effect.gen(function* () {
    yield* Effect.logInfo("Creating Polar customer");
    const client = yield* HttpClient.HttpClient;
    const requestBody = yield* HttpBody.json({
      email: input.email,
      name: input.name,
      external_id: input.externalId,
    }).pipe(
      Effect.mapError(
        () =>
          new PolarApiError({
            message: "Failed to encode request",
            status: HttpStatus.InternalServerError,
            operation: "create_customer",
          }),
      ),
    );
    const response = yield* client
      .post(`${polarBaseUrl(env)}/v1/customers/`, {
        headers: authHeaders(env.POLAR_ACCESS_TOKEN),
        body: requestBody,
      })
      .pipe(Effect.mapError(() => networkError("create_customer")));

    if (response.status >= 200 && response.status < 300) {
      return yield* HttpClientResponse.schemaBodyJson(polarCustomerSchema)(response).pipe(
        Effect.mapError(() => parseError("create_customer")),
      );
    }
    return yield* handleCreateError(response, client, env, input.email);
  }).pipe(Effect.provide(liveHttpClient()));

const runPolar = <T>(effect: Effect.Effect<T, PolarApiError>, context: LogContext): Promise<T> =>
  runAdapter(
    effect,
    (error) =>
      new AdapterError({
        status: error.status || HttpStatus.InternalServerError,
        message: error.message,
      }),
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
        return toProblemResponse(HttpStatus.InternalServerError, errorMessage);
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

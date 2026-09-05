import { Effect, Layer, Schema } from "effect";
import {
  FetchHttpClient,
  Headers,
  HttpBody,
  HttpClient,
  HttpClientResponse,
} from "effect/unstable/http";
import {
  polarCheckoutSchema,
  polarCustomerSessionSchema,
  type PolarCheckout,
  type PolarCustomerSession,
} from "@tom/schemas/polar";
import { PolarApiError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import { logApiFailure, toProblemResponse } from "@tom/utils/services/worker";

const authHeaders = (accessToken: string | undefined) =>
  Headers.fromInput({
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  });

/**
 * HttpClient bound to the current global fetch. Built per call because the
 * Fetch reference default pins the first-seen implementation process-wide.
 */
const liveHttpClient = (): Layer.Layer<HttpClient.HttpClient> =>
  Layer.provideMerge(FetchHttpClient.layer, Layer.succeed(FetchHttpClient.Fetch, globalThis.fetch));

interface PolarCheckoutCreate {
  readonly products: ReadonlyArray<string>;
  readonly successUrl: string | undefined;
  readonly customerId: string | undefined;
  readonly customerEmail: string | undefined;
}

interface PolarCustomerSessionCreate {
  readonly customerId: string;
  readonly returnUrl: string;
}

const postPolarJson = <A, I>(
  url: string,
  accessToken: string | undefined,
  body: PolarCheckoutCreate | PolarCustomerSessionCreate,
  schema: Schema.Codec<A, I, never>,
  operation: string,
  failureMessage: string,
): Effect.Effect<A, PolarApiError> =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const requestBody = yield* HttpBody.json(body).pipe(
      Effect.mapError(
        () =>
          new PolarApiError({
            message: "Failed to encode request",
            status: HttpStatus.InternalServerError,
            operation,
          }),
      ),
    );
    const response = yield* client
      .post(url, {
        headers: authHeaders(accessToken),
        body: requestBody,
      })
      .pipe(
        Effect.mapError(
          () => new PolarApiError({ message: "Network error", status: 0, operation }),
        ),
      );

    const okResponse = yield* HttpClientResponse.filterStatusOk(response).pipe(
      Effect.tapError((error) =>
        logApiFailure(failureMessage, error.response?.status ?? HttpStatus.InternalServerError),
      ),
      Effect.mapError(
        (error) =>
          new PolarApiError({
            message: failureMessage,
            status: error.response?.status ?? HttpStatus.InternalServerError,
            operation,
          }),
      ),
    );

    return yield* HttpClientResponse.schemaBodyJson(schema)(okResponse).pipe(
      Effect.mapError(
        () =>
          new PolarApiError({
            message: "Failed to parse response",
            status: HttpStatus.InternalServerError,
            operation,
          }),
      ),
    );
  }).pipe(Effect.provide(liveHttpClient()));

export const createPolarCheckout = (
  accessToken: string | undefined,
  baseUrl: string,
  params: {
    products: string[];
    successUrl: string | undefined;
    customerId: string | undefined;
    customerEmail: string | undefined;
  },
): Effect.Effect<PolarCheckout, PolarApiError> =>
  Effect.gen(function* () {
    yield* Effect.logInfo("Creating Polar checkout session");
    return yield* postPolarJson(
      `${baseUrl}/v1/checkouts/`,
      accessToken,
      {
        products: params.products,
        successUrl: params.successUrl,
        customerId: params.customerId,
        customerEmail: params.customerEmail,
      },
      polarCheckoutSchema,
      "create_checkout",
      "Failed to create Polar checkout",
    );
  }).pipe(Effect.withSpan("polar.checkout"));

export const createPolarCustomerSession = (
  accessToken: string | undefined,
  baseUrl: string,
  params: { customerId: string; returnUrl: string },
): Effect.Effect<PolarCustomerSession, PolarApiError> =>
  Effect.gen(function* () {
    yield* Effect.logInfo("Creating Polar customer session");
    return yield* postPolarJson(
      `${baseUrl}/v1/customer-sessions/`,
      accessToken,
      {
        customerId: params.customerId,
        returnUrl: params.returnUrl,
      },
      polarCustomerSessionSchema,
      "create_customer_session",
      "Failed to create Polar customer session",
    );
  }).pipe(Effect.withSpan("polar.customerSession"));

export const handlePolarError = (error: PolarApiError): Response =>
  toProblemResponse(
    error.status >= HttpStatus.BadRequest && error.status < HttpStatus.InternalServerError
      ? error.status
      : HttpStatus.InternalServerError,
    error.message,
  );

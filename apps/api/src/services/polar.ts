import { Effect } from "effect";
import { PolarApiError } from "@tom/types/errors";
import { HttpStatus } from "@tom/constants/http";
import { logApiFailure, toProblemResponse } from "@tom/utils/services/worker";

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

export const createPolarCheckout = (
  accessToken: string | undefined,
  baseUrl: string,
  params: {
    products: string[];
    successUrl: string | undefined;
    customerId: string | undefined;
    customerEmail: string | undefined;
  },
): Effect.Effect<{ url: string }, PolarApiError> =>
  Effect.gen(function* () {
    yield* Effect.logInfo("Creating Polar checkout session");
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(`${baseUrl}/v1/checkouts/`, {
          method: "POST",
          headers: authHeaders(accessToken),
          body: JSON.stringify({
            products: params.products,
            successUrl: params.successUrl,
            customerId: params.customerId,
            customerEmail: params.customerEmail,
          }),
        }),
      catch: () =>
        new PolarApiError({
          message: "Network error",
          status: 0,
          operation: "create_checkout",
        }),
    });

    if (!response.ok) {
      yield* logApiFailure("Failed to create Polar checkout", response.status);
      return yield* new PolarApiError({
        message: "Failed to create checkout",
        status: response.status,
        operation: "create_checkout",
      });
    }

    return yield* parseJson<{ url: string }>(response, "create_checkout");
  }).pipe(Effect.withSpan("polar.checkout"));

export const createPolarCustomerSession = (
  accessToken: string | undefined,
  baseUrl: string,
  params: { customerId: string; returnUrl: string },
): Effect.Effect<{ customer_portal_url: string }, PolarApiError> =>
  Effect.gen(function* () {
    yield* Effect.logInfo("Creating Polar customer session");
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(`${baseUrl}/v1/customer-sessions/`, {
          method: "POST",
          headers: authHeaders(accessToken),
          body: JSON.stringify({
            customerId: params.customerId,
            returnUrl: params.returnUrl,
          }),
        }),
      catch: () =>
        new PolarApiError({
          message: "Network error",
          status: 0,
          operation: "create_customer_session",
        }),
    });

    if (!response.ok) {
      yield* logApiFailure("Failed to create Polar customer session", response.status);
      return yield* new PolarApiError({
        message: "Failed to create customer session",
        status: response.status,
        operation: "create_customer_session",
      });
    }

    return yield* parseJson<{ customer_portal_url: string }>(response, "create_customer_session");
  }).pipe(Effect.withSpan("polar.customerSession"));

export const handlePolarError = (error: PolarApiError): Response =>
  toProblemResponse(
    error.status >= HttpStatus.BadRequest && error.status < HttpStatus.InternalServerError
      ? error.status
      : HttpStatus.InternalServerError,
    error.message,
  );

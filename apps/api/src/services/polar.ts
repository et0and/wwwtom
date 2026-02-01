import { Effect } from "effect";
import { PolarApiError } from "@tom/types";
import { HttpStatus } from "@tom/constants";

export const fetchPolarProducts = (
  accessToken: string | undefined,
): Effect.Effect<unknown[], PolarApiError> =>
  Effect.gen(function* () {
    yield* Effect.logInfo("Fetching products from Polar API");
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
      yield* Effect.logError("Failed to fetch Polar products", {
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

export const fetchPolarProduct = (
  productId: string,
  accessToken: string | undefined,
): Effect.Effect<unknown, PolarApiError> =>
  Effect.gen(function* () {
    yield* Effect.logInfo(`Fetching product ${productId} from Polar API`);
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
      yield* Effect.logError(`Failed to fetch Polar product ${productId}`, {
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

export const createPolarCustomer = (
  email: string,
  name: string | undefined,
  externalId: string | undefined,
  accessToken: string | undefined,
): Effect.Effect<unknown, PolarApiError> =>
  Effect.gen(function* () {
    yield* Effect.logInfo("Customer doesn't exist in Polar, creating now");
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
        yield* Effect.logInfo("Customer already exists in Polar, fetching details");
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
          yield* Effect.logError(`Failed to find existing Polar customer with email ${email}`, {
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

      yield* Effect.logError("Failed to create Polar customer", {
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

export const handlePolarError = (error: PolarApiError): Response => {
  return new Response(JSON.stringify({ error: error.message }), {
    status: error.status as
      | HttpStatus.BadGateway
      | HttpStatus.NotFound
      | HttpStatus.InternalServerError,
    headers: { "Content-Type": "application/json" },
  });
};

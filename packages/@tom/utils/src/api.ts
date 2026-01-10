import { Effect } from "effect";
import { HttpError } from "@tom/types";
import type { Product, Customer, CustomerInput } from "@tom/types";

export const getApiBase = (isDev: boolean): string =>
  isDev ? "http://localhost:8787" : "https://api.tom.so";

export const formatPrice = (product: Product): string => {
  const amt = product.prices?.[0]?.price_amount;
  return amt !== undefined && amt !== null ? `$${amt / 100}` : "";
};

export const fetchProducts = (isDev: boolean): Effect.Effect<Product[], HttpError> =>
  Effect.gen(function* () {
    const base = getApiBase(isDev);
    const response = yield* Effect.tryPromise({
      try: () => fetch(`${base}/products`),
      catch: () => new HttpError({ message: "Network error", status: 0 }),
    });

    if (!response.ok) {
      return yield* Effect.fail(
        new HttpError({
          message: "Failed to load products",
          status: response.status,
        }),
      );
    }

    return yield* Effect.tryPromise({
      try: () => response.json() as Promise<Product[]>,
      catch: () => new HttpError({ message: "Failed to parse response", status: 500 }),
    });
  });

export const fetchProduct = (
  productId: string,
  isDev: boolean,
): Effect.Effect<Product, HttpError> =>
  Effect.gen(function* () {
    const base = getApiBase(isDev);
    const response = yield* Effect.tryPromise({
      try: () => fetch(`${base}/products/${productId}`),
      catch: () => new HttpError({ message: "Network error", status: 0 }),
    });

    if (!response.ok) {
      return yield* Effect.fail(
        new HttpError({
          message: "Failed to load product",
          status: response.status,
        }),
      );
    }

    return yield* Effect.tryPromise({
      try: () => response.json() as Promise<Product>,
      catch: () => new HttpError({ message: "Failed to parse response", status: 500 }),
    });
  });

export const createCustomer = (
  input: CustomerInput,
  isDev: boolean,
): Effect.Effect<Customer, HttpError> =>
  Effect.gen(function* () {
    const base = getApiBase(isDev);
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(`${base}/customers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }),
      catch: () => new HttpError({ message: "Network error", status: 0 }),
    });

    if (!response.ok) {
      const errorData = yield* Effect.tryPromise({
        try: () => response.json() as Promise<{ error?: string }>,
        catch: () =>
          new HttpError({
            message: "Failed to create customer",
            status: response.status,
          }),
      });
      return yield* Effect.fail(
        new HttpError({
          message: errorData.error ?? "Failed to create customer",
          status: response.status,
        }),
      );
    }

    return yield* Effect.tryPromise({
      try: () => response.json() as Promise<Customer>,
      catch: () => new HttpError({ message: "Failed to parse response", status: 500 }),
    });
  });

export const getCheckoutUrl = (productId: string, customerId: string, isDev: boolean): string => {
  const base = getApiBase(isDev);
  return `${base}/checkout?products=${productId}&customerId=${customerId}`;
};

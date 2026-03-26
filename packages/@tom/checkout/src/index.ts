import { Effect } from "effect";
import { HttpError } from "@tom/types";
import type { Product, Customer, CustomerInput } from "@tom/types";
import { HttpStatus } from "@tom/constants";

const getCheckoutApiBase = (isDev: boolean): string =>
  isDev ? "http://localhost:8787" : "https://api.tom.so";

export const formatPrice = (product: Product): string => {
  const amt = product.prices?.[0]?.price_amount;
  return amt !== undefined && amt !== null ? `$${amt / 100}` : "Free";
};

export const fetchProducts = Effect.fn("fetchProducts")(function* (isDev: boolean) {
  const base = getCheckoutApiBase(isDev);
  const response = yield* Effect.tryPromise({
    try: () => fetch(`${base}/products`),
    catch: () => new HttpError({ message: "Network error", status: 0 }),
  });

  if (!response.ok) {
    return yield* new HttpError({
      message: "Failed to load products",
      status: response.status,
    });
  }

  return yield* Effect.tryPromise({
    try: () => response.json() as Promise<Product[]>,
    catch: () =>
      new HttpError({
        message: "Failed to parse response",
        status: HttpStatus.InternalServerError,
      }),
  });
});

export const fetchProduct = Effect.fn("fetchProduct")(function* (
  productId: string,
  isDev: boolean,
) {
  const base = getCheckoutApiBase(isDev);
  const response = yield* Effect.tryPromise({
    try: () => fetch(`${base}/products/${productId}`),
    catch: () => new HttpError({ message: "Network error", status: 0 }),
  });

  if (!response.ok) {
    return yield* new HttpError({
      message: "Failed to load product",
      status: response.status,
    });
  }

  return yield* Effect.tryPromise({
    try: () => response.json() as Promise<Product>,
    catch: () =>
      new HttpError({
        message: "Failed to parse response",
        status: HttpStatus.InternalServerError,
      }),
  });
});

export const createCustomer = Effect.fn("createCustomer")(function* (
  input: CustomerInput,
  isDev: boolean,
) {
  const base = getCheckoutApiBase(isDev);
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
    return yield* new HttpError({
      message: errorData.error ?? "Failed to create customer",
      status: response.status,
    });
  }

  return yield* Effect.tryPromise({
    try: () => response.json() as Promise<Customer>,
    catch: () =>
      new HttpError({
        message: "Failed to parse response",
        status: HttpStatus.InternalServerError,
      }),
  });
});

export const getCheckoutUrl = (productId: string, customerId: string, isDev: boolean): string => {
  const base = getCheckoutApiBase(isDev);
  return `${base}/checkout?products=${productId}&customerId=${customerId}`;
};

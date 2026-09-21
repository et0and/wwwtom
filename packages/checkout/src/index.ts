import type { Product } from "@tom/types/product";

export const formatPrice = (product: Product): string => {
  const price = product.prices?.[0];
  // Number.isFinite doubles as the Finite-schema check: null, undefined,
  // and NaN amounts all render as "Free". (Schema.is(Schema.Finite) would
  // need an effect dependency this package does not declare.)
  if (price === undefined || !Number.isFinite(price.price_amount)) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.price_currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price.price_amount / 100);
};

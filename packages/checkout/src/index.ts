import type { Product } from "@tom/types/product";

export const formatPrice = (product: Product): string => {
  const amt = product.prices?.[0]?.price_amount;
  return amt !== undefined && amt !== null ? `$${amt / 100}` : "Free";
};

export const formatNZD = (cents: number): string =>
  new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    minimumFractionDigits: 2,
  }).format(cents / 100);

import type { ProductCreate } from "@polar-sh/sdk/models/components/productcreate.js";

export const staticProducts: ProductCreate[] = [
  {
    name: "Basic Product",
    recurringInterval: null, // One-off
    prices: [
      {
        amountType: "fixed",
        priceAmount: 1000, // $10.00
        priceCurrency: "usd",
      },
    ],
    organizationId: process.env.POLAR_ORGANIZATION_ID!,
  },
];

// Store for dynamic products (in production, use a database)
export const dynamicProducts: Array<{ id: string; name: string; description?: string; polarId: string }> = [];

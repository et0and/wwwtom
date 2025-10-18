import type { ProductCreate } from "@polar-sh/sdk/models/components/productcreate.js";
import { getDb } from "~/lib/db";

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

// Function to load dynamic products from D1
export async function getDynamicProducts(d1: D1Database) {
  const db = getDb(d1);
  const products = await db.select().from(dynamicProductsTable);
  return products.map(p => ({
    id: p.polarId,
    name: p.name,
    description: p.description,
    price: p.price,
    currency: p.currency,
    polarId: p.polarId,
  }));
}

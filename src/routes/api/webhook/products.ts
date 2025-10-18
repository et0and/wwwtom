import { json } from "solid-start/api";
import { Polar } from "@polar-sh/sdk";
import { dynamicProducts } from "~/products";

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
});

export async function POST({ request }: { request: Request }) {
  const body = await request.json();
  const { name, description, price, currency = "usd" } = body;

  if (!name || !price) {
    return json({ error: "Name and price required" }, { status: 400 });
  }

  // Create product in Polar
  const product = await polar.products.create({
    name,
    description,
    recurringInterval: null,
    prices: [{ amountType: "fixed", priceAmount: price, priceCurrency: currency }],
    organizationId: process.env.POLAR_ORGANIZATION_ID!,
  });

  // Store locally
  dynamicProducts.push({
    id: product.id,
    name,
    description,
    polarId: product.id,
  });

  return json({ success: true, productId: product.id });
}

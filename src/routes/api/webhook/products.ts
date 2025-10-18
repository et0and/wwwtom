import { json } from "solid-start/api";
import { Polar } from "@polar-sh/sdk";
import { getDb } from "~/lib/db";

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
});

export async function POST({ request }: { request: Request }) {
  // API Key authentication
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.WEBHOOK_API_KEY) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, price, currency = "usd" } = body;

    // Input validation
    if (!name || typeof name !== "string" || name.length > 255) {
      return json({ error: "Invalid or missing name" }, { status: 400 });
    }
    if (!price || typeof price !== "number" || price <= 0 || price > 100000000) { // Max $1M
      return json({ error: "Invalid price" }, { status: 400 });
    }
    if (description && (typeof description !== "string" || description.length > 1000)) {
      return json({ error: "Invalid description" }, { status: 400 });
    }
    if (!["usd", "eur", "gbp"].includes(currency.toLowerCase())) {
      return json({ error: "Unsupported currency" }, { status: 400 });
    }

    // Create product in Polar
    const product = await polar.products.create({
      name,
      description,
      recurringInterval: null,
      prices: [{ amountType: "fixed", priceAmount: Math.round(price), priceCurrency: currency }],
      organizationId: process.env.POLAR_ORGANIZATION_ID!,
    });

    // Store in D1
    const db = getDb(request.d1);
    await db.insert(dynamicProductsTable).values({
      name,
      description,
      price: Math.round(price),
      currency: currency.toLowerCase(),
      polarId: product.id,
    });

    return json({ success: true, productId: product.id });
  } catch (error) {
    console.error("Webhook error:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}

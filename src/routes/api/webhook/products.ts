import { json } from "solid-start/api";
import { Polar } from "@polar-sh/sdk";
import { getDb } from "~/lib/db";
import { dynamicProductCreateSchema, apiResponseSchema } from "~/lib/schemas";

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

    // Validate input with Zod
    const validationResult = dynamicProductCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return json({
        error: "Validation failed",
        details: validationResult.error.issues
      }, { status: 400 });
    }

    const { name, description, price, currency } = validationResult.data;

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
      currency,
      polarId: product.id,
    });

    // Validate response
    const response = apiResponseSchema.parse({
      success: true,
      productId: product.id
    });

    return json(response);
  } catch (error) {
    console.error("Webhook error:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}

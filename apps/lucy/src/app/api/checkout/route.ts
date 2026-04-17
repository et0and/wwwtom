import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch((): null => null);

  if (body == null || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const record = body as Record<string, unknown>;

  const productSlug = typeof record.productSlug === "string" ? record.productSlug.trim() : null;
  const rawQuantity = typeof record.quantity === "number" ? record.quantity : null;

  if (productSlug == null || productSlug.length === 0) {
    return NextResponse.json({ error: "productSlug is required." }, { status: 400 });
  }

  if (rawQuantity == null || !Number.isInteger(rawQuantity) || rawQuantity < 1) {
    return NextResponse.json({ error: "quantity must be a positive integer." }, { status: 400 });
  }

  const payload = await getPayload({ config });

  const result = await payload.find({
    collection: "products",
    where: {
      and: [{ slug: { equals: productSlug } }, { _status: { equals: "published" } }],
    },
    depth: 1,
    limit: 1,
  });

  const product = result.docs[0] ?? null;

  if (product == null) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const stripePriceId = product.stripeSync?.stripePriceId;
  const isPurchasable =
    product.isAvailable === true &&
    product.stripeSync?.stripeSyncStatus === "synced" &&
    typeof stripePriceId === "string" &&
    stripePriceId.length > 0;

  if (!isPurchasable) {
    return NextResponse.json(
      { error: "This product is not available for purchase." },
      { status: 400 },
    );
  }

  const quantity = Math.min(Math.max(1, rawQuantity), product.maxQuantity ?? 10);

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const shippingRateId = process.env.STRIPE_NZ_SHIPPING_RATE_ID;

  if (typeof secretKey !== "string" || secretKey.length === 0) {
    return NextResponse.json({ error: "Checkout is not configured." }, { status: 500 });
  }

  if (typeof shippingRateId !== "string" || shippingRateId.length === 0) {
    return NextResponse.json({ error: "Shipping is not configured." }, { status: 500 });
  }

  const stripe = getStripe(secretKey);

  const origin = new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price: stripePriceId,
        quantity,
      },
    ],
    shipping_address_collection: {
      allowed_countries: ["NZ"],
    },
    shipping_options: [
      {
        shipping_rate: shippingRateId,
      },
    ],
    metadata: {
      productId: String(product.id),
      productSlug: product.slug ?? "",
    },
    client_reference_id: String(product.id),
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/products/${product.slug}`,
  });

  if (session.url == null) {
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}

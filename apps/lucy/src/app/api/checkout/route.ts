import { Effect } from "effect";
import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { getStripe } from "@/lib/stripe";
import {
  InvalidRequestBody,
  ProductNotFound,
  ProductNotPurchasable,
  CheckoutConfigError,
  CheckoutSessionError,
  type CheckoutError,
} from "@/lib/errors";
import { CloudflareLoggerLive } from "@/lib/logger";

const createCheckoutSession = Effect.fn("createCheckoutSession")(function* (request: Request) {
  // Parse and validate body
  const body = yield* Effect.tryPromise({
    try: () => request.json() as Promise<unknown>,
    catch: () => new InvalidRequestBody({ message: "Invalid request body." }),
  });

  if (body == null || typeof body !== "object") {
    return yield* new InvalidRequestBody({
      message: "Invalid request body.",
    });
  }

  const record = body as Record<string, unknown>;

  const productSlug = typeof record.productSlug === "string" ? record.productSlug.trim() : null;
  const rawQuantity = typeof record.quantity === "number" ? record.quantity : null;

  if (productSlug == null || productSlug.length === 0) {
    return yield* new InvalidRequestBody({
      message: "productSlug is required.",
    });
  }

  if (rawQuantity == null || !Number.isInteger(rawQuantity) || rawQuantity < 1) {
    return yield* new InvalidRequestBody({
      message: "quantity must be a positive integer.",
    });
  }

  // Look up product
  yield* Effect.logInfo("Looking up product", { productSlug });

  const payload = yield* Effect.promise(() => getPayload({ config }));

  const result = yield* Effect.promise(() =>
    payload.find({
      collection: "products",
      where: {
        and: [{ slug: { equals: productSlug } }, { _status: { equals: "published" } }],
      },
      depth: 1,
      limit: 1,
    }),
  );

  const product = result.docs[0] ?? null;

  if (product == null) {
    return yield* new ProductNotFound({ productSlug });
  }

  // Check purchasability
  const stripePriceId = product.stripeSync?.stripePriceId;
  const isPurchasable =
    product.isAvailable === true &&
    product.stripeSync?.stripeSyncStatus === "synced" &&
    typeof stripePriceId === "string" &&
    stripePriceId.length > 0;

  if (!isPurchasable) {
    return yield* new ProductNotPurchasable({
      productSlug,
      reason: "This product is not available for purchase.",
    });
  }

  const quantity = Math.min(Math.max(1, rawQuantity), product.maxQuantity ?? 10);

  // Validate config
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const shippingRateId = process.env.STRIPE_NZ_SHIPPING_RATE_ID;

  if (typeof secretKey !== "string" || secretKey.length === 0) {
    return yield* new CheckoutConfigError({
      message: "Checkout is not configured.",
    });
  }

  if (typeof shippingRateId !== "string" || shippingRateId.length === 0) {
    return yield* new CheckoutConfigError({
      message: "Shipping is not configured.",
    });
  }

  // Create Stripe checkout session
  yield* Effect.logInfo("Creating checkout session", {
    productSlug,
    quantity,
  });

  const stripe = getStripe(secretKey);
  const origin = new URL(request.url).origin;

  const session = yield* Effect.tryPromise({
    try: () =>
      stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: stripePriceId, quantity }],
        shipping_address_collection: {
          allowed_countries: ["NZ"],
        },
        shipping_options: [{ shipping_rate: shippingRateId }],
        metadata: {
          productId: String(product.id),
          productSlug: product.slug ?? "",
        },
        client_reference_id: String(product.id),
        success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/products/${product.slug}`,
      }),
    catch: (cause) => new CheckoutSessionError({ cause }),
  });

  if (session.url == null) {
    return yield* new CheckoutSessionError({
      cause: new Error("Session URL is null"),
    });
  }

  yield* Effect.logInfo("Checkout session created", {
    productSlug,
    url: session.url,
  });

  return { url: session.url };
});

function toNextResponse(error: CheckoutError): NextResponse {
  switch (error._tag) {
    case "InvalidRequestBody":
      return NextResponse.json({ error: error.message }, { status: error.httpStatus });
    case "ProductNotFound":
      return NextResponse.json({ error: "Product not found." }, { status: error.httpStatus });
    case "ProductNotPurchasable":
      return NextResponse.json({ error: error.reason }, { status: error.httpStatus });
    case "CheckoutConfigError":
      return NextResponse.json({ error: error.message }, { status: error.httpStatus });
    case "CheckoutSessionError":
      return NextResponse.json(
        { error: "Failed to create checkout session." },
        { status: error.httpStatus },
      );
  }
}

export async function POST(request: Request) {
  return Effect.runPromise(
    createCheckoutSession(request).pipe(
      Effect.withLogSpan("checkout"),
      Effect.annotateLogs({ method: "POST", route: "/api/checkout" }),
      Effect.map((data) => NextResponse.json(data)),
      Effect.catchTags({
        InvalidRequestBody: (error) => Effect.succeed(toNextResponse(error)),
        ProductNotFound: (error) => Effect.succeed(toNextResponse(error)),
        ProductNotPurchasable: (error) => Effect.succeed(toNextResponse(error)),
        CheckoutConfigError: (error) => Effect.succeed(toNextResponse(error)),
        CheckoutSessionError: (error) =>
          Effect.gen(function* () {
            yield* Effect.logError("Checkout session creation failed", { cause: error.cause });
            return toNextResponse(error);
          }),
      }),
      Effect.provide(CloudflareLoggerLive),
    ),
  );
}

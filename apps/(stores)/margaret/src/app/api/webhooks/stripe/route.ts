import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { renderOrderConfirmationEmail } from "@/email/orderConfirmation";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  const stripe = getStripe(secretKey);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  try {
    const payload = await getPayload({ config });

    // Idempotency check
    const existing = await payload.find({
      collection: "orders",
      where: { stripeSessionId: { equals: session.id } },
      limit: 1,
    });

    if (existing.docs.length > 0) {
      return NextResponse.json({ received: true });
    }

    // Retrieve full session with expanded data
    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items", "shipping_details"],
    });

    const productId = fullSession.metadata?.productId;
    if (!productId) {
      payload.logger.error(`No productId in session metadata: ${session.id}`);
      return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    }

    // Look up product
    const product = await payload.findByID({
      collection: "products",
      id: productId,
    });

    const quantity = fullSession.line_items?.data[0]?.quantity ?? 1;
    const orderNumber = `MRG-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
    const shippingAddress = fullSession.shipping_details?.address;
    const customerName = fullSession.customer_details?.name ?? "";

    // Determine stock status
    const currentStock = product.stock ?? 0;
    const newStock = currentStock - quantity;
    const isFlagged = newStock < 0;

    // Create order
    const order = await payload.create({
      collection: "orders",
      data: {
        orderNumber,
        status: isFlagged ? "flagged" : "paid",
        customerEmail: fullSession.customer_details?.email ?? "",
        product: product.id,
        quantity,
        amountPaid: fullSession.amount_total ?? 0,
        shippingAddress: {
          name: customerName,
          line1: shippingAddress?.line1 ?? "",
          line2: shippingAddress?.line2 ?? undefined,
          city: shippingAddress?.city ?? "",
          postalCode: shippingAddress?.postal_code ?? "",
          country: shippingAddress?.country ?? "NZ",
        },
        stripeSessionId: session.id,
        stripePaymentIntentId:
          typeof fullSession.payment_intent === "string"
            ? fullSession.payment_intent
            : (fullSession.payment_intent?.id ?? ""),
        notes: isFlagged ? "Order flagged: insufficient stock at time of processing." : undefined,
      },
    });

    // Decrement stock
    const stockUpdate: Record<string, unknown> = {
      stock: Math.max(0, newStock),
    };
    if (newStock <= 0) {
      stockUpdate.isAvailable = false;
    }

    await payload.update({
      collection: "products",
      id: product.id,
      data: stockUpdate,
      context: { skipHooks: true },
    });

    // Send confirmation email (best-effort)
    try {
      const { subject, html } = renderOrderConfirmationEmail({
        orderNumber,
        productName: product.name,
        quantity,
        amountPaid: fullSession.amount_total ?? 0,
        shippingAddress: {
          name: customerName,
          line1: shippingAddress?.line1 ?? "",
          line2: shippingAddress?.line2 ?? undefined,
          city: shippingAddress?.city ?? "",
          postalCode: shippingAddress?.postal_code ?? "",
          country: shippingAddress?.country ?? "NZ",
        },
      });

      await payload.sendEmail({
        to: fullSession.customer_details?.email ?? "",
        subject,
        html,
      });

      await payload.update({
        collection: "orders",
        id: order.id,
        data: { confirmationEmailSent: true },
        context: { skipHooks: true },
      });
    } catch (emailError) {
      payload.logger.error(
        `Failed to send confirmation email for order ${order.id}: ${String(emailError)}`,
      );
    }

    return NextResponse.json({ received: true });
  } catch (processingError) {
    const payload = await getPayload({ config });
    payload.logger.error(`Webhook processing failed: ${String(processingError)}`);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

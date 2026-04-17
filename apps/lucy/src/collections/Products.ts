import type { CollectionAfterChangeHook, CollectionConfig } from "payload";
import { slugField } from "payload";

import { readProducts, createProducts, updateProducts, deleteProducts } from "../access/products";
import { getStripe } from "../lib/stripe";

const syncProductToStripe: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (req.context?.skipHooks) return;

  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    await req.payload.update({
      collection: "products",
      id: doc.id,
      data: {
        stripeSync: {
          stripeSyncStatus: "error",
          stripeSyncError: "STRIPE_SECRET_KEY not configured",
        },
      },
      context: { skipHooks: true },
      req,
    });
    return;
  }

  const stripe = getStripe(secretKey);

  try {
    const name = doc.name as string;
    const description = (doc.shortDescription as string | undefined) ?? "";

    const existingProductId = doc.stripeSync?.stripeProductId as string | undefined;

    const stripeProduct = existingProductId
      ? await stripe.products.update(existingProductId, { name, description })
      : await stripe.products.create({
          name,
          description,
          metadata: { payloadId: String(doc.id) },
        });

    const nextStripeProductId = stripeProduct.id;

    const existingPriceId = doc.stripeSync?.stripePriceId as string | undefined;
    const previousUnitAmount = previousDoc?.unitAmountNZD as number | undefined;
    const currentUnitAmount = doc.unitAmountNZD as number;
    const priceChanged = !existingPriceId || currentUnitAmount !== previousUnitAmount;

    const nextStripePriceId = await (async () => {
      if (!priceChanged) return existingPriceId as string;

      const newPrice = await stripe.prices.create(
        {
          product: nextStripeProductId,
          unit_amount: currentUnitAmount,
          currency: "nzd",
        },
        { idempotencyKey: `price-${doc.id}-${currentUnitAmount}` },
      );

      if (existingPriceId && existingPriceId !== newPrice.id) {
        await stripe.prices.update(existingPriceId, { active: false });
      }

      return newPrice.id;
    })();

    await req.payload.update({
      collection: "products",
      id: doc.id,
      data: {
        stripeSync: {
          stripeProductId: nextStripeProductId,
          stripePriceId: nextStripePriceId,
          stripeSyncStatus: "synced",
          stripeSyncError: "",
        },
      },
      context: { skipHooks: true },
      req,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await req.payload.update({
      collection: "products",
      id: doc.id,
      data: {
        stripeSync: {
          stripeSyncStatus: "error",
          stripeSyncError: errorMessage,
        },
      },
      context: { skipHooks: true },
      req,
    });
  }
};

export const Products: CollectionConfig = {
  slug: "products",
  labels: { singular: "Product", plural: "Products" },
  admin: {
    useAsTitle: "name",
    defaultColumns: [
      "name",
      "unitAmountNZD",
      "isAvailable",
      "stripeSyncStatus",
      "_status",
      "updatedAt",
    ],
    group: "Store",
  },
  versions: {
    drafts: {
      autosave: { interval: 375 },
    },
  },
  access: {
    read: readProducts,
    create: createProducts,
    update: updateProducts,
    delete: deleteProducts,
  },
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        if (data._status === "published") {
          if (data.stripeSync?.stripeSyncStatus !== "synced" || !data.stripeSync?.stripePriceId) {
            throw new Error(
              "Cannot publish: Stripe sync must be completed before publishing. Save as draft first and wait for sync.",
            );
          }
        }
        return data;
      },
    ],
    afterChange: [
      syncProductToStripe,
      async ({ doc, req }) => {
        try {
          await fetch(
            `${process.env.NEXT_PUBLIC_SERVER_URL}/api/revalidate?secret=${process.env.REVALIDATION_KEY}&path=/products/${doc.slug}`,
          );
          await fetch(
            `${process.env.NEXT_PUBLIC_SERVER_URL}/api/revalidate?secret=${process.env.REVALIDATION_KEY}&path=/products`,
          );
        } catch {
          // revalidation failure is non-fatal
        }
      },
    ],
  },
  fields: [
    // ── Core content ──────────────────────────────────────────
    {
      name: "name",
      type: "text",
      required: true,
      label: "Product Name",
    },
    slugField({
      position: undefined,
    }),
    {
      name: "shortDescription",
      type: "text",
      label: "Short Description",
      admin: {
        description: "Shown on the product listing page. Keep under 160 characters.",
      },
      maxLength: 160,
    },
    {
      name: "content",
      type: "blocks",
      label: "Product Description",
      blocks: [],
    },
    {
      name: "featuredImage",
      type: "upload",
      relationTo: "media",
      label: "Featured Image",
      required: false,
    },
    {
      name: "gallery",
      type: "array",
      label: "Gallery",
      admin: {
        description: "Additional product images shown on the detail page.",
      },
      fields: [
        {
          name: "image",
          type: "upload",
          relationTo: "media",
          required: true,
        },
        {
          name: "alt",
          type: "text",
          label: "Alt Text",
        },
      ],
    },

    // ── Pricing ───────────────────────────────────────────────
    {
      name: "unitAmountNZD",
      type: "number",
      label: "Price (NZD cents)",
      required: true,
      min: 1,
      admin: {
        description:
          "Enter price in cents. e.g. $29.99 = 2999. GST-inclusive. Currency is always NZD.",
        step: 1,
      },
    },

    // ── Availability ──────────────────────────────────────────
    {
      name: "isAvailable",
      type: "checkbox",
      label: "Available for Purchase",
      defaultValue: false,
      admin: {
        position: "sidebar",
        description:
          "Product must be available AND published AND synced to Stripe before checkout is enabled.",
      },
    },
    {
      name: "maxQuantity",
      type: "number",
      label: "Max Quantity per Order",
      defaultValue: 10,
      min: 1,
      required: true,
      admin: {
        position: "sidebar",
        step: 1,
      },
    },

    // ── Stripe (read-only, written by sync hook) ──────────────
    {
      name: "stripeSync",
      type: "group",
      label: "Stripe",
      admin: {
        position: "sidebar",
        description: "Managed automatically. Do not edit manually.",
      },
      fields: [
        {
          name: "stripeProductId",
          type: "text",
          label: "Stripe Product ID",
          admin: { readOnly: true },
        },
        {
          name: "stripePriceId",
          type: "text",
          label: "Stripe Price ID",
          admin: { readOnly: true },
        },
        {
          name: "stripeSyncStatus",
          type: "select",
          label: "Sync Status",
          defaultValue: "pending",
          options: [
            { label: "Pending", value: "pending" },
            { label: "Synced", value: "synced" },
            { label: "Error", value: "error" },
          ],
          admin: { readOnly: true },
        },
        {
          name: "stripeSyncError",
          type: "text",
          label: "Last Sync Error",
          admin: { readOnly: true },
        },
      ],
    },

    // ── SEO ───────────────────────────────────────────────────
    {
      name: "meta",
      type: "group",
      label: "SEO",
      fields: [
        { name: "title", type: "text", label: "Meta Title" },
        { name: "description", type: "text", label: "Meta Description" },
        {
          name: "image",
          type: "upload",
          relationTo: "media",
          label: "OG Image",
        },
      ],
    },
  ],
};

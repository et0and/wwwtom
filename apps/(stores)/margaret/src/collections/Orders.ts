import type { CollectionConfig } from "payload";

export const Orders: CollectionConfig = {
  slug: "orders",
  labels: { singular: "Order", plural: "Orders" },
  admin: {
    useAsTitle: "orderNumber",
    defaultColumns: ["orderNumber", "customerEmail", "status", "createdAt"],
    group: "Store",
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "orderNumber",
      type: "text",
      required: true,
      unique: true,
      label: "Order Number",
    },
    {
      name: "product",
      type: "relationship",
      relationTo: "products",
      required: true,
    },
    {
      name: "quantity",
      type: "number",
      required: true,
      min: 1,
    },
    {
      name: "amountPaid",
      type: "number",
      required: true,
      label: "Amount Paid (NZD cents)",
    },
    {
      name: "customerEmail",
      type: "email",
      required: true,
      label: "Customer Email",
    },
    {
      name: "stripeSessionId",
      type: "text",
      required: true,
      unique: true,
      label: "Stripe Session ID",
    },
    {
      name: "stripePaymentIntentId",
      type: "text",
      label: "Stripe Payment Intent ID",
    },
    {
      name: "status",
      type: "select",
      defaultValue: "paid",
      options: [
        { label: "Paid", value: "paid" },
        { label: "Shipped", value: "shipped" },
        { label: "Refunded", value: "refunded" },
        { label: "Flagged", value: "flagged" },
      ],
    },
    {
      name: "shippingAddress",
      type: "group",
      label: "Shipping Address",
      fields: [
        {
          name: "name",
          type: "text",
          required: true,
        },
        {
          name: "line1",
          type: "text",
          required: true,
          label: "Address Line 1",
        },
        {
          name: "line2",
          type: "text",
          label: "Address Line 2",
        },
        {
          name: "city",
          type: "text",
          required: true,
        },
        {
          name: "postalCode",
          type: "text",
          required: true,
          label: "Postal Code",
        },
        {
          name: "country",
          type: "text",
        },
      ],
    },
    {
      name: "confirmationEmailSent",
      type: "checkbox",
      defaultValue: false,
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "notes",
      type: "textarea",
      admin: {
        position: "sidebar",
      },
    },
  ],
};

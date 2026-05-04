import type { CollectionConfig } from "payload";
import { slugField } from "payload";
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from "@payloadcms/plugin-seo/fields";

import { readProducts, createProducts, updateProducts, deleteProducts } from "../access/products";
import { ContentBlock } from "../blocks/ContentBlock";
import { ImageBlock } from "../blocks/ImageBlock";
import { YouTubeBlock } from "../blocks/YouTubeBlock";

export const Products: CollectionConfig = {
  slug: "products",
  access: {
    create: createProducts,
    delete: deleteProducts,
    read: readProducts,
    update: updateProducts,
  },
  admin: {
    defaultColumns: ["name", "priceLabel", "isAvailable", "_status", "updatedAt"],
    useAsTitle: "name",
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
    },
    slugField({
      position: undefined,
    }),
    {
      name: "featuredImage",
      type: "upload",
      relationTo: "media",
    },
    {
      name: "content",
      type: "blocks",
      blocks: [ContentBlock, ImageBlock, YouTubeBlock],
    },
    {
      name: "shortDescription",
      type: "text",
    },
    {
      name: "gallery",
      type: "array",
      fields: [
        {
          name: "image",
          type: "upload",
          relationTo: "media",
        },
        {
          name: "alt",
          type: "text",
        },
      ],
    },
    {
      name: "priceLabel",
      type: "text",
      admin: {
        description: "Display price, for example $45 NZD.",
      },
    },
    {
      name: "stripePaymentLink",
      type: "text",
      admin: {
        description: "Paste the Stripe Payment Link for this product.",
      },
      validate: (value: string | null | undefined) => {
        if (value == null || value.length === 0) return true;

        try {
          const url = new URL(value);
          if (url.protocol === "https:" && url.hostname.endsWith("stripe.com")) {
            return true;
          }
        } catch {
          return "Enter a valid Stripe Payment Link URL.";
        }

        return "Enter a valid Stripe Payment Link URL.";
      },
    },
    {
      name: "isAvailable",
      type: "checkbox",
      defaultValue: true,
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "meta",
      type: "group",
      fields: [
        OverviewField({
          titlePath: "meta.title",
          descriptionPath: "meta.description",
          imagePath: "meta.image",
        }),
        MetaTitleField({
          hasGenerateFn: true,
        }),
        MetaImageField({
          relationTo: "media",
        }),
        MetaDescriptionField({}),
        PreviewField({
          hasGenerateFn: true,
          titlePath: "meta.title",
          descriptionPath: "meta.description",
        }),
      ],
    },
  ],
  versions: {
    drafts: {
      autosave: true,
    },
  },
};

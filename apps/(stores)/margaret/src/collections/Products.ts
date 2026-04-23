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
    defaultColumns: ["name", "isAvailable", "_status", "updatedAt"],
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
      name: "unitAmountNZD",
      type: "number",
      required: true,
      admin: {
        description: "Price in NZD cents",
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
      name: "maxQuantity",
      type: "number",
      defaultValue: 10,
      required: true,
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "stock",
      type: "number",
      defaultValue: 0,
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "stripeSync",
      type: "group",
      admin: {
        position: "sidebar",
      },
      fields: [
        {
          name: "stripeProductId",
          type: "text",
        },
        {
          name: "stripePriceId",
          type: "text",
        },
        {
          name: "stripeSyncStatus",
          type: "select",
          options: ["pending", "synced", "error"],
          defaultValue: "pending",
        },
        {
          name: "stripeSyncError",
          type: "text",
        },
      ],
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

import type { CollectionConfig } from "payload";
import { slugField } from "payload";
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from "@payloadcms/plugin-seo/fields";

import { createPosts, deletePosts, readPosts, updatePosts } from "../access/posts";
import { ContentBlock } from "../blocks/ContentBlock";
import { ImageBlock } from "../blocks/ImageBlock";
import { YouTubeBlock } from "../blocks/YouTubeBlock";

export const Posts: CollectionConfig = {
  slug: "posts",
  access: {
    create: createPosts,
    delete: deletePosts,
    read: readPosts,
    update: updatePosts,
  },
  admin: {
    defaultColumns: ["title", "status", "category", "publishedAt"],
    useAsTitle: "title",
  },
  fields: [
    {
      name: "title",
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
      name: "excerpt",
      type: "text",
      maxLength: 300,
    },
    {
      name: "content",
      type: "blocks",
      blocks: [ContentBlock, ImageBlock, YouTubeBlock],
      required: true,
    },
    {
      name: "author",
      type: "relationship",
      relationTo: "users",
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "category",
      type: "relationship",
      relationTo: "categories",
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "tags",
      type: "relationship",
      relationTo: "tags",
      hasMany: true,
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
    {
      name: "status",
      type: "select",
      options: ["draft", "published"],
      defaultValue: "draft",
      admin: {
        position: "sidebar",
      },
    },
    {
      name: "publishedAt",
      type: "date",
      admin: {
        date: {
          pickerAppearance: "dayAndTime",
        },
        position: "sidebar",
      },
      hooks: {
        beforeChange: [
          ({ siblingData, value }) => {
            if (siblingData.status === "published" && !value) {
              return new Date();
            }
            return value;
          },
        ],
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ req, operation, data, originalDoc }) => {
        // Auto-assign author on create
        if (operation === "create" && !data.author && req.user) {
          data.author = req.user.id;
        }
        // Auto-set publishedAt when status changes to 'published'
        if (
          operation === "update" &&
          data.status === "published" &&
          originalDoc?.status !== "published" &&
          !data.publishedAt
        ) {
          data.publishedAt = new Date();
        }
        // Auto-set publishedAt on create if status is published
        if (operation === "create" && data.status === "published" && !data.publishedAt) {
          data.publishedAt = new Date();
        }
        return data;
      },
    ],
  },
  versions: {
    drafts: {
      autosave: true,
    },
  },
};

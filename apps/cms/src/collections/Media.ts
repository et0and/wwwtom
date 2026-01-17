import type { CollectionConfig } from "payload";

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from "@payloadcms/richtext-lexical";

import { authenticated } from "../access/authenticated";
import { frontendOnly } from "../access/frontendOnly";
import { getOptimizedMediaUrl } from "../utilities/getCDNUrl";

export const Media: CollectionConfig = {
  slug: "media",
  access: {
    create: authenticated,
    delete: authenticated,
    read: frontendOnly,
    update: authenticated,
  },
  upload: {
    disableLocalStorage: true,
    adminThumbnail: "thumbnail",
    focalPoint: true,
    imageSizes: [
      {
        name: "thumbnail",
        width: 300,
      },
      {
        name: "square",
        width: 500,
        height: 500,
      },
      {
        name: "small",
        width: 600,
      },
      {
        name: "medium",
        width: 900,
      },
      {
        name: "large",
        width: 1400,
      },
      {
        name: "xlarge",
        width: 1920,
      },
      {
        name: "og",
        width: 1200,
        height: 630,
        crop: "center",
      },
    ],
  },
  hooks: {
    afterRead: [
      ({ doc }) => {
        if (doc.url) {
          doc.url = getOptimizedMediaUrl(doc.url);
        }
        if (doc.sizes) {
          Object.keys(doc.sizes).forEach((sizeKey) => {
            const size = doc.sizes[sizeKey];
            if (size?.url) {
              doc.sizes[sizeKey].url = getOptimizedMediaUrl(
                size.url,
                sizeKey as Parameters<typeof getOptimizedMediaUrl>[1],
              );
            }
          });
        }
        return doc;
      },
    ],
  },
  fields: [
    {
      name: "alt",
      type: "text",
      //required: true,
    },
    {
      name: "caption",
      type: "richText",
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()];
        },
      }),
    },
  ],
};

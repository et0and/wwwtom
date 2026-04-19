import type { CollectionConfig } from "payload";

import { getCDNUrl } from "../utilities/getCDNUrl";

export const Media: CollectionConfig = {
  slug: "media",
  access: {
    read: () => true,
  },
  upload: {
    // These are not supported on Workers yet due to lack of sharp
    crop: false,
    focalPoint: false,
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
      },
    ],
  },
  hooks: {
    afterRead: [
      ({ doc }) => {
        // Convert R2 URLs to CDN URLs
        if (doc.url) {
          doc.url = getCDNUrl(doc.url);
        }
        if (doc.sizes) {
          Object.keys(doc.sizes).forEach((size) => {
            const sizeData = doc.sizes[size];
            if (sizeData?.url) {
              sizeData.url = getCDNUrl(sizeData.url);
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
      required: true,
    },
  ],
};

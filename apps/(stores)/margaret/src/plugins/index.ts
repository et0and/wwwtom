import { seoPlugin } from "@payloadcms/plugin-seo";
import type { Plugin } from "payload";

export const plugins: Plugin[] = [
  seoPlugin({
    generateTitle: ({ doc }) => doc?.name ?? doc?.title ?? "Grandma Hope",
    generateURL: ({ doc }) => `https://grandmahope.yufugumi.com/products/${doc?.slug}`,
  }),
];

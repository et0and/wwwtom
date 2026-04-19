import { seoPlugin } from "@payloadcms/plugin-seo";
import type { Plugin } from "payload";

export const plugins: Plugin[] = [
  seoPlugin({
    generateTitle: ({ doc }) => doc?.name ?? doc?.title ?? "Lucy",
    generateURL: ({ doc }) => `https://lucy.st/products/${doc?.slug}`,
  }),
];

import { seoPlugin } from "@payloadcms/plugin-seo";
import type { Plugin } from "payload";

export const plugins: Plugin[] = [
  seoPlugin({
    generateTitle: ({ doc }) => doc?.title ?? "Tom.so",
    generateURL: ({ doc }) => `https://tom.so/posts/${doc?.slug}`,
  }),
];

import { seoPlugin } from "@payloadcms/plugin-seo";
import type { Plugin } from "payload";

export const plugins: Plugin[] = [
  seoPlugin({
    generateTitle: ({ doc }) => doc?.title ?? "Sophie",
    generateURL: ({ doc }) => `https://sophie.st/posts/${doc?.slug}`,
  }),
];

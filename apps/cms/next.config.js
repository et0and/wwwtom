import { withPayload } from "@payloadcms/next/withPayload";

import redirects from "./redirects.js";

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.NETLIFY_SITE_URL
    ? process.env.NETLIFY_SITE_URL
    : process.env.__NEXT_PRIVATE_ORIGIN || "http://localhost:3100";

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".mts", ".cts", ".mjs", ".cjs"],
  },
  output: "standalone",
  images: {
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL, "https://cdn.tom.so"].filter(Boolean).map((item) => {
        const url = new URL(item);

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(":", ""),
        };
      }),
    ],
  },
  reactStrictMode: true,
  redirects,
  trailingSlash: true,
};

export default withPayload(nextConfig, { devBundleServerPackages: false });

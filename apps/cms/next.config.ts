import { withPayload } from "@payloadcms/next/withPayload";

import redirects from "./redirects";

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.NETLIFY_SITE_URL
    ? process.env.NETLIFY_SITE_URL
    : process.env.__NEXT_PRIVATE_ORIGIN || "http://localhost:3200";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone" as const,
  // Packages with Cloudflare Workers (workerd) specific code
  // see https://opennext.js.org/cloudflare/howtos/workerd
  serverExternalPackages: ["jose", "pg-cloudflare", "typescript"],
  images: {
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL, "https://cdn.tom.so"].filter(Boolean).map((item) => {
        const url = new URL(item);

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(":", "") as "http" | "https",
        };
      }),
    ],
  },
  reactStrictMode: true,
  redirects,
  trailingSlash: true,
  webpack: (webpackConfig: any) => {
    webpackConfig.resolve.extensionAlias = {
      ".cjs": [".cts", ".cjs"],
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };

    return webpackConfig;
  },
};

export default withPayload(nextConfig, { devBundleServerPackages: false });

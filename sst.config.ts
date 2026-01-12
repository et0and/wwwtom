import * as cloudflare from "sst/cloudflare";

export default $config({
  app(input) {
    return {
      name: "@tom/monorepo",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "cloudflare",
    };
  },
  async run() {
    const kv = new cloudflare.KV("TOM_RATE_LIMIT_KV", {
      binding: "TOM_RATE_LIMIT_KV",
      id: "b3800e793bb94ddab775776d600e1c64",
    });

    const hyperdrive = new cloudflare.Hyperdrive("HYPERDRIVE", {
      id: "28cd876116cf4d599b68d6579c92d331",
      binding: "HYPERDRIVE",
    });

    const web = new cloudflare.Worker("Web", {
      handler: "apps/web/.output/server/index.mjs",
      url: true,
      link: [kv, hyperdrive],
      build: {
        command: "cd apps/web && bun run build",
      },
      environment: {
        NODE_ENV: "production",
      },
      assets: {
        directory: "apps/web/.output/public",
      },
    });

    const api = new cloudflare.Worker("Api", {
      handler: "apps/api/src/index.ts",
      url: true,
      environment: {
        NODE_ENV: "production",
      },
    });

    return {
      web: web.url,
      api: api.url,
    };
  },
});

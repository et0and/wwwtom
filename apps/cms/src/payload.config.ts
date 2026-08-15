import fs from "fs";
import { sqliteD1Adapter } from "@payloadcms/db-d1-sqlite";
import { s3Storage } from "@payloadcms/storage-s3";
import { TomSecretsSchema } from "@tom/schemas/secrets";
import { Option, Schema } from "effect";

import path from "path";
import { buildConfig, PayloadRequest } from "payload";
import { fileURLToPath } from "url";
import { CloudflareContext, getCloudflareContext } from "@opennextjs/cloudflare";
import { GetPlatformProxyOptions } from "wrangler";

import { Categories } from "./collections/Categories";
import { Media } from "./collections/Media";
import { Pages } from "./collections/Pages";
import { Posts } from "./collections/Posts";
import { Users } from "./collections/Users";
import { Works } from "./collections/Works";
import { Footer } from "./Footer/config";
import { Header } from "./Header/config";
import { plugins } from "./plugins";
import { defaultLexical } from "@/fields/defaultLexical";
import { getServerSideURL } from "./utilities/getURL";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const realpath = (value: string) => (fs.existsSync(value) ? fs.realpathSync(value) : undefined);

const isCLI = process.argv.some((value) =>
  realpath(value)?.endsWith(path.join("payload", "bin.js")),
);
const isProduction = process.env.NODE_ENV === "production";
const phase = process.env.NEXT_PHASE;
const isCi = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
const isBuild =
  phase === "phase-production-build" ||
  phase === "phase-export" ||
  process.env.npm_lifecycle_event === "build" ||
  process.argv.includes("build");

const cloudflare =
  isCLI || !isProduction || isBuild || isCi
    ? await getCloudflareContextFromWrangler()
    : await getCloudflareContext({ async: true });

// The TOM_SECRETS bundle is bound as a single JSON secret (Secrets Store);
// hydrate the env vars Payload reads. The bundle is absent on the
// CLI/wrangler-proxy paths (migrate, build), where process.env is set
// explicitly.
const secretBundle = Schema.decodeUnknownOption(TomSecretsSchema)(cloudflare.env.TOM_SECRETS);
if (Option.isSome(secretBundle)) {
  for (const key of [
    "PAYLOAD_SECRET",
    "CRON_SECRET",
    "S3_BUCKET",
    "S3_ENDPOINT",
    "S3_REGION",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ]) {
    const value = secretBundle.value[key];
    if (value) process.env[key] = value;
  }
}

const payloadSecret = process.env.PAYLOAD_SECRET || "";

export default buildConfig({
  admin: {
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: "Mobile",
          name: "mobile",
          width: 375,
          height: 667,
        },
        {
          label: "Tablet",
          name: "tablet",
          width: 768,
          height: 1024,
        },
        {
          label: "Desktop",
          name: "desktop",
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: sqliteD1Adapter({ binding: cloudflare.env.D1, push: false }),
  collections: [Pages, Posts, Works, Media, Categories, Users],
  cors: [
    getServerSideURL(),
    "http://localhost:3000",
    "https://tom.so",
    "https://www.tom.so",
  ].filter(Boolean),
  globals: [Header, Footer],
  plugins: [
    ...plugins,
    s3Storage({
      bucket: process.env.S3_BUCKET || "your-bucket-name",
      config: {
        endpoint: process.env.S3_ENDPOINT || "https://s3.us-east-005.backblazeb2.com",
        region: process.env.S3_REGION || "us-east-005",
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
        },
      },
      collections: {
        media: true,
      },
      disableLocalStorage: true,
    }),
  ],
  secret: payloadSecret,
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true;

        // If there is no logged in user, then check
        // for the cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get("authorization");
        return authHeader === `Bearer ${process.env.CRON_SECRET}`;
      },
    },
    tasks: [],
  },
});

// Adapted from https://github.com/opennextjs/opennextjs-cloudflare/blob/d00b3a13e42e65aad76fba41774815726422cc39/packages/cloudflare/src/api/cloudflare-context.ts#L328C36-L328C46
function getCloudflareContextFromWrangler(): Promise<CloudflareContext> {
  return import(/* webpackIgnore: true */ `${"__wrangler".replaceAll("_", "")}`).then(
    ({ getPlatformProxy }) =>
      getPlatformProxy({
        environment: process.env.CLOUDFLARE_ENV,
        remoteBindings: isProduction && !isBuild && !isCi,
      } satisfies GetPlatformProxyOptions),
  );
}

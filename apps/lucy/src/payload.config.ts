import fs from "fs";
import path from "path";
import { sqliteD1Adapter } from "@payloadcms/db-d1-sqlite";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";
import { fileURLToPath } from "url";
import { CloudflareContext, getCloudflareContext } from "@opennextjs/cloudflare";
import { GetPlatformProxyOptions } from "wrangler";
import { r2Storage } from "@payloadcms/storage-r2";

import { Users } from "./collections/Users";
import { Media } from "./collections/Media";
import { Products } from "./collections/Products";
import { plugins } from "./plugins";

type R2StorageOptions = Parameters<typeof r2Storage>[0];

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

const createLog =
  (level: string, fn: typeof console.log) => (objOrMsg: object | string, msg?: string) => {
    if (typeof objOrMsg === "string") {
      fn(JSON.stringify({ level, msg: objOrMsg }));
    } else {
      fn(JSON.stringify({ level, ...objOrMsg, msg: msg ?? (objOrMsg as { msg?: string }).msg }));
    }
  };

const cloudflareLogger = {
  level: process.env.PAYLOAD_LOG_LEVEL || "info",
  trace: createLog("trace", console.debug),
  debug: createLog("debug", console.debug),
  info: createLog("info", console.log),
  warn: createLog("warn", console.warn),
  error: createLog("error", console.error),
  fatal: createLog("fatal", console.error),
  silent: () => {},
} as any; // Use PayloadLogger type when it's exported

const cloudflare =
  isCLI || !isProduction || isBuild || isCi
    ? await getCloudflareContextFromWrangler()
    : await getCloudflareContext({ async: true });

const payloadSecretBinding = Reflect.get(cloudflare.env, "PAYLOAD_SECRET");
const payloadSecret =
  process.env.PAYLOAD_SECRET ||
  (typeof payloadSecretBinding === "string" ? payloadSecretBinding : "");

if (!process.env.PAYLOAD_SECRET && payloadSecret) {
  process.env.PAYLOAD_SECRET = payloadSecret;
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      description: "Grace Chapel Studios store instance",
      icons: [
        {
          type: "image/png",
          rel: "icon",
          url: "/assets/favicon.svg",
        },
      ],
      openGraph: {
        description: "Grace Chapel Studios store instance",
        images: [
          {
            height: 600,
            url: "/assets/ogImage.png",
            width: 800,
          },
        ],
        title: "Grace Chapel Studios",
      },
      titleSuffix: "- GCS",
    },
  },
  collections: [Users, Media, Products],
  editor: lexicalEditor(),
  secret: payloadSecret,
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: sqliteD1Adapter({ binding: cloudflare.env.D1 }),
  logger: isProduction ? cloudflareLogger : undefined,
  plugins: [
    ...plugins,
    r2Storage({
      bucket: cloudflare.env.R2 as unknown as R2StorageOptions["bucket"],
      collections: { media: true },
    }),
  ],
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

import fs from "fs";
import path from "path";
import { sqliteD1Adapter } from "@payloadcms/db-d1-sqlite";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { TomSecretsSchema } from "@tom/schemas/secrets";
import { Option, Schema } from "effect";
import { buildConfig } from "payload";
import { fileURLToPath } from "url";
import { CloudflareContext, getCloudflareContext } from "@opennextjs/cloudflare";
import { GetPlatformProxyOptions } from "wrangler";
import { r2Storage } from "@payloadcms/storage-r2";

import { Users } from "./collections/Users";
import { Media } from "./collections/Media";
import { Categories } from "./collections/Categories";
import { Tags } from "./collections/Tags";
import { Posts } from "./collections/Posts";
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

type LogValue = string | number | boolean | null | undefined;

// Pino-style log entry: either a bare message string or a key/value payload.
type LogEntry = string | { readonly [key: string]: LogValue };

const isMessage = (entry: LogEntry): entry is string => entry === String(entry);

const createLog = (level: string, fn: typeof console.log) => (entry: LogEntry, msg?: string) => {
  if (isMessage(entry)) {
    fn(JSON.stringify({ level, msg: entry }));
  } else {
    fn(JSON.stringify({ level, ...entry, msg: msg ?? entry.msg }));
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

// The TOM_SECRETS bundle is bound as a single JSON secret (Secrets Store);
// hydrate the env vars Payload reads. The bundle is absent on the
// CLI/wrangler-proxy paths (migrate, build), where process.env is set
// explicitly.
const secretBundle = Schema.decodeUnknownOption(TomSecretsSchema)(cloudflare.env.TOM_SECRETS);
if (Option.isSome(secretBundle)) {
  const payloadSecret = secretBundle.value.PAYLOAD_SECRET;
  if (payloadSecret) process.env.PAYLOAD_SECRET = payloadSecret;
}

const payloadSecret = process.env.PAYLOAD_SECRET || "";

// workers-types `R2Bucket.get` overloads require `options`, which is stricter
// than the storage-r2 contract; adapt the binding to it explicitly.
const storageBucket: R2StorageOptions["bucket"] = {
  createMultipartUpload: (key, options) => cloudflare.env.R2.createMultipartUpload(key, options),
  delete: (keys) => cloudflare.env.R2.delete(keys),
  // The storage-r2 `R2GetOptions.range` is looser than the workers one;
  // the runtime shapes match (both are HTTP range requests).
  get: (key, options) => cloudflare.env.R2.get(key, options as R2GetOptions | undefined),
  head: (key) => cloudflare.env.R2.head(key),
  list: (options) => cloudflare.env.R2.list(options),
  put: (key, value, options) => cloudflare.env.R2.put(key, value, options),
  resumeMultipartUpload: (key, uploadId) => cloudflare.env.R2.resumeMultipartUpload(key, uploadId),
};

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Categories, Tags, Posts],
  editor: lexicalEditor(),
  secret: payloadSecret,
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: sqliteD1Adapter({ binding: cloudflare.env.D1, push: false }),
  logger: isProduction ? cloudflareLogger : undefined,
  plugins: [
    ...plugins,
    r2Storage({
      bucket: storageBucket,
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

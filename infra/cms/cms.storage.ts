import * as d1 from "@distilled.cloud/cloudflare/d1";
import * as r2 from "@distilled.cloud/cloudflare/r2";
import * as Cloudflare from "alchemy/Cloudflare";
import { CloudflareEnvironment } from "alchemy/Cloudflare";
import { Effect, Stream } from "effect";
import { retain } from "alchemy/RemovalPolicy";
import { Stage } from "alchemy/Stage";

export const cmsD1 = Effect.gen(function* () {
  const stage = yield* Stage;

  return yield* Cloudflare.D1.Database("wwwtom-cms-d1", {
    // Production reuses the existing Payload D1; the new tables coexist
    // with the Payload tables until the Payload admin retires. Other
    // stages get isolated databases.
    ...(stage === "production" ? { name: "tom-cms" } : undefined),
    migrationsDir: `${import.meta.dirname}/migrations`,
  });
});

export const cmsMediaBucket = Effect.gen(function* () {
  const stage = yield* Stage;

  return yield* Cloudflare.R2.Bucket("wwwtom-cms-media", {
    ...(stage === "production" ? { name: "tom-cms-media" } : undefined),
  });
});

// PR previews read the dev database + bucket directly so posts/works
// render real content. No migrations run here (dev is already migrated).
// Retained unconditionally: destroying a preview stage releases these
// handles without ever deleting dev resources. Preview writes are
// impractical (GitHub OAuth cannot issue sessions on preview origins),
// so sharing dev content is safe.
//
// Dev handles resolve by stable name prefix at deploy time instead of a
// hardcoded full name: alchemy appends a random suffix per resource, so
// only the `{stack}-{resource}-{stage}-` prefix survives a recreation.
// Exactly one match is required — zero or several fail the deploy loudly.
// Bump these prefixes only if the api stack or resource ids are renamed.
const DEV_D1_PREFIX = "wwwtom-api-wwwtom-cms-d1-dev-";
const DEV_MEDIA_PREFIX = "wwwtom-api-wwwtom-cms-media-dev-";

const findDevDatabase = Effect.fn("cmsStorage.findDevDatabase")(function* () {
  const { accountId } = yield* yield* CloudflareEnvironment;
  const pages = yield* d1.listDatabases.pages({ accountId }).pipe(Stream.runCollect);
  const matches = Array.from(pages)
    .flatMap((page) => page.result ?? [])
    .map((database) => database.name ?? "")
    .filter((name) => name.startsWith(DEV_D1_PREFIX));
  const [match] = matches;
  if (matches.length !== 1 || match === undefined) {
    return yield* Effect.die(
      new Error(`expected exactly one dev CMS database, found ${matches.length}`),
    );
  }
  return match;
});

const findDevBucket = Effect.fn("cmsStorage.findDevBucket")(function* () {
  const { accountId } = yield* yield* CloudflareEnvironment;
  const response = yield* r2.listBuckets({ accountId, nameContains: "wwwtom-cms-media-dev" });
  const matches = (response.buckets ?? [])
    .map((bucket) => bucket.name ?? "")
    .filter((name) => name.startsWith(DEV_MEDIA_PREFIX));
  const [match] = matches;
  if (matches.length !== 1 || match === undefined) {
    return yield* Effect.die(
      new Error(`expected exactly one dev CMS bucket, found ${matches.length}`),
    );
  }
  return match;
});

export const previewCmsD1 = Effect.gen(function* () {
  const name = yield* findDevDatabase().pipe(Effect.orDie);
  return yield* Cloudflare.D1.Database("wwwtom-preview-cms-d1", { name }).pipe(retain());
});

export const previewCmsMedia = Effect.gen(function* () {
  const name = yield* findDevBucket().pipe(Effect.orDie);
  return yield* Cloudflare.R2.Bucket("wwwtom-preview-cms-media", { name }).pipe(retain());
});

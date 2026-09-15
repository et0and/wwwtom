import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { Stage } from "alchemy/Stage";

export const sophieD1 = Effect.gen(function* () {
  const stage = yield* Stage;

  return yield* Cloudflare.D1.Database("sophie-cms-d1", {
    // Fresh Sophie database. It starts empty; Sophie posts plus categories
    // land here. Same migrations as Tom CMS, separate data.
    //
    // Production uses a fresh database name: the Payload tables in
    // sophie-cms share names with the CMS tables (posts, categories, media,
    // works) but not shapes, so 0001_content's CREATE TABLE IF NOT EXISTS
    // silently kept the legacy shapes and every CMS query failed. Same
    // reason Tom uses tom-cms-v2; sophie-cms stays live for the Payload
    // worker until it retires.
    ...(stage === "production" ? { name: "sophie-cms-v2" } : undefined),
    migrationsDir: `${import.meta.dirname}/migrations`,
  });
});

export const sophieMediaBucket = Effect.gen(function* () {
  const stage = yield* Stage;

  return yield* Cloudflare.R2.Bucket("sophie-cms-media", {
    ...(stage === "production" ? { name: "sophie-cms-media" } : undefined),
  });
});

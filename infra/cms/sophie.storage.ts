import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { Stage } from "alchemy/Stage";

export const sophieD1 = Effect.gen(function* () {
  const stage = yield* Stage;

  return yield* Cloudflare.D1.Database("sophie-cms-d1", {
    // Fresh Sophie database. It starts empty; Sophie posts plus categories
    // land here. Same migrations as Tom CMS, separate data.
    ...(stage === "production" ? { name: "sophie-cms" } : undefined),
    migrationsDir: `${import.meta.dirname}/migrations`,
  });
});

export const sophieMediaBucket = Effect.gen(function* () {
  const stage = yield* Stage;

  return yield* Cloudflare.R2.Bucket("sophie-cms-media", {
    ...(stage === "production" ? { name: "sophie-cms-media" } : undefined),
  });
});

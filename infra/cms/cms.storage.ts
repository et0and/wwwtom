import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
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

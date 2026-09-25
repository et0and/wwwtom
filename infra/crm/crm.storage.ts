import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { Stage } from "alchemy/Stage";

export const crmD1 = Effect.gen(function* () {
  const stage = yield* Stage;
  return yield* Cloudflare.D1.Database("wwwtom-crm-d1", {
    ...(stage === "production" ? { name: "tom-crm-d1" } : undefined),
    migrations: `${import.meta.dirname}/migrations`,
  });
});

export const crmMediaBucket = Effect.gen(function* () {
  const stage = yield* Stage;
  return yield* Cloudflare.R2.Bucket("wwwtom-crm-media", {
    ...(stage === "production" ? { name: "tom-crm-media" } : undefined),
  });
});

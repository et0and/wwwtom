import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { Stage } from "alchemy/Stage";

export const apiKv = Effect.gen(function* () {
  const stage = yield* Stage;

  return yield* Cloudflare.KV.Namespace("wwwtom-api-kv", {
    // Adopt the existing production namespace; other stages get their own.
    ...(stage === "production" ? { title: "TOM_RATE_LIMIT_KV" } : {}),
  });
});

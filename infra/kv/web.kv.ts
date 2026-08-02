import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { Stage } from "alchemy/Stage";

export const webKv = Effect.gen(function* () {
  const stage = yield* Stage;

  return yield* Cloudflare.KV.Namespace("wwwtom-web-kv", {
    // Adopt the existing production namespace; other stages get their own.
    ...(stage === "production" ? { title: "TOM_RATE_LIMIT_KV" } : {}),
  });
});

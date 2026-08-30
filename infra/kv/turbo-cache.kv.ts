import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { Stage } from "alchemy/Stage";

export const turboCacheKv = Effect.gen(function* () {
  const stage = yield* Stage;

  return yield* Cloudflare.KV.Namespace("wwwtom-turbo-cache", {
    // Deterministic title for the production namespace; other stages get
    // their own isolated namespace.
    ...(stage === "production" ? { title: "wwwtom-turbo-cache" } : undefined),
  });
});

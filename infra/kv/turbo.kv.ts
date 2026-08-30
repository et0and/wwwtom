import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { Stage } from "alchemy/Stage";

export const turboKv = Effect.gen(function* () {
  const stage = yield* Stage;

  // The logical id must differ from the Worker's (`wwwtom-turbo`), or alchemy
  // merges the two into one resource and the env binding becomes a
  // self-service binding instead of a KV namespace.
  return yield* Cloudflare.KV.Namespace("wwwtom-turbo-kv", {
    // Deterministic title for the production namespace; other stages get
    // their own isolated namespace.
    ...(stage === "production" ? { title: "wwwtom-turbo" } : undefined),
  });
});

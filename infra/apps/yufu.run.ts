import * as Cloudflare from "@alchemy.run/cloudflare";
import { Effect } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { stageHost, workerObservability } from "../shared.run.ts";

const rootDir = `${import.meta.dirname}/../../apps/yufu`;

export const yufu = Effect.gen(function* () {
  const stage = yield* Stage;

  // Client-only Effect UI SPA: no server runtime, routes and bindings.
  return yield* Cloudflare.Website.Vite("yufu", {
    rootDir,
    compatibility: { flags: ["nodejs_compat"] },
    // Only the custom domain: workers.dev would bypass the zone edge rules.
    workersDev: false,
    observability: workerObservability,
    ...(stage === "production"
      ? { name: "yufu", domain: stageHost(stage, "yufu") }
      : { name: `yufu-${stage}`, domain: stageHost(stage, "yufu") }),
    env: {
      NODE_ENV: "production",
    },
  });
});

export default Stack(
  "yufu",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const app = yield* yufu;

    return {
      url: app.url,
    };
  }),
);

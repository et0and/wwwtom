import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { slateWebHost, workerObservability } from "../shared.run.ts";

const rootDir = `${import.meta.dirname}/../../apps/slate`;

export const slateWeb = Effect.gen(function* () {
  const stage = yield* Stage;

  // Static Astro site: Astro prerenders every page and Alchemy deploys the
  // assets only. The page is deliberately Worker-free.
  return yield* Cloudflare.Website.Astro("slate-web", {
    rootDir,
    astro: {
      output: "static",
      site: `https://${slateWebHost(stage)}`,
      trailingSlash: "never",
    },
    assets: { notFoundHandling: "404-page" },
    workersDev: false,
    observability: workerObservability,
    ...(stage === "production"
      ? { name: "slate-web", domain: slateWebHost(stage) }
      : { name: `slate-web-${stage}`, domain: slateWebHost(stage) }),
  });
});

export default Stack(
  "slate",
  {
    providers: Cloudflare.providers() as never,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const app = yield* slateWeb;

    return {
      url: app.url,
    };
  }),
);

import * as Cloudflare from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import { Effect, Layer } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { stageHost } from "../shared.run.ts";
import { previewComment } from "../utils/github/preview-comment.ts";

const rootDir = `${import.meta.dirname}/../../apps/jigjam`;

export const jigjam = Effect.gen(function* () {
  const stage = yield* Stage;

  // Static Vite SPA with no server runtime: every puzzle runs locally in the
  // browser (images, edges, timer, and progress all live in localStorage),
  // so the deploy inlines nothing and binds nothing.
  return yield* Cloudflare.Website.Vite("wwwtom-jigjam", {
    rootDir,
    compatibility: { flags: ["nodejs_compat"] },
    ...(stage === "production"
      ? { name: "wwwtom-jigjam", domain: stageHost(stage, "jigjam") }
      : { name: `wwwtom-jigjam-${stage}`, domain: stageHost(stage, "jigjam") }),
    env: {
      NODE_ENV: "production",
    },
  });
});

export default Stack(
  "wwwtom-jigjam",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()) as never,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const app = yield* jigjam;
    yield* previewComment({ name: "Jigjam", url: app.url });

    return {
      url: app.url,
    };
  }),
);

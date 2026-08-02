import * as Cloudflare from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import { Effect, Layer } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { webHyperdrive } from "../hyperdrive/web.hyperdrive.ts";
import { webKv } from "../kv/web.kv.ts";
import { tomSecrets } from "../shared.run.ts";
import { previewComment } from "../utils/github/preview-comment.ts";

const rootDir = `${import.meta.dirname}/../../apps/web`;

export const web = Effect.gen(function* () {
  const stage = yield* Stage;

  return yield* Cloudflare.Website.Vite("wwwtom-web", {
    rootDir,
    compatibility: { flags: ["nodejs_compat"] },
    // Adopt the existing production Worker and keep its custom domain.
    ...(stage === "production" ? { name: "wwwtom", domain: "tom.so" } : {}),
    env: {
      NODE_ENV: "production",
      TOM_SECRETS: tomSecrets,
      TOM_RATE_LIMIT_KV: webKv,
      HYPERDRIVE: webHyperdrive,
    },
  });
});

export default Stack(
  "wwwtom-web",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()) as never,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const app = yield* web;
    yield* previewComment({ name: "Web", url: app.url });

    return {
      url: app.url,
    };
  }),
);

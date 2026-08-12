import * as Cloudflare from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import { ALCHEMY_DEV } from "alchemy";
import { Effect, Layer } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { webHyperdrive } from "../hyperdrive/web.hyperdrive.ts";
import { webKv } from "../kv/web.kv.ts";
import { tomQueue } from "../queues/tom.queue.ts";
import { stageHost, stageWebHost, tomSecrets } from "../shared.run.ts";
import { previewComment } from "../utils/github/preview-comment.ts";

const rootDir = `${import.meta.dirname}/../../apps/web`;

export const web = Effect.gen(function* () {
  const stage = yield* Stage;
  const isAlchemyDev = yield* ALCHEMY_DEV;
  const adapterHost = stageHost(stage, "adapter");

  return yield* Cloudflare.Website.Vite("wwwtom-web", {
    rootDir,
    compatibility: { flags: ["nodejs_compat"] },
    // Every stage gets a deterministic worker name and custom domain so the
    // adapter can redirect back to it (production adopts the existing worker).
    ...(stage === "production"
      ? { name: "wwwtom", domain: stageWebHost(stage) }
      : { name: `wwwtom-${stage}`, domain: stageWebHost(stage) }),
    env: {
      NODE_ENV: "production",
      TOM_SECRETS: tomSecrets,
      TOM_RATE_LIMIT_KV: webKv,
      HYPERDRIVE: webHyperdrive,
      WORK_QUEUE: tomQueue,
      ADAPTER_URL: isAlchemyDev ? "http://localhost:8788" : `https://${adapterHost}`,
      // Inlined into the client bundle at build time (Alchemy VITE_ prefix).
      ...(isAlchemyDev ? {} : { VITE_ADAPTER_URL: `https://${adapterHost}` }),
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

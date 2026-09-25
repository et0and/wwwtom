import * as Cloudflare from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import { ALCHEMY_DEV } from "alchemy";
import { Effect, Layer } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { stageHost } from "../shared.run.ts";
import { previewComment } from "../utils/github/preview-comment.ts";

const rootDir = `${import.meta.dirname}/../../apps/crm`;

export const crm = Effect.gen(function* () {
  const stage = yield* Stage;
  const isAlchemyDev = yield* ALCHEMY_DEV;
  const adapterHost = stage.startsWith("pr-")
    ? stageHost("dev", "adapter")
    : stageHost(stage, "adapter");

  return yield* Cloudflare.Website.Vite("wwwtom-crm", {
    rootDir,
    compatibility: { flags: ["nodejs_compat"] },
    ...(stage === "production"
      ? { name: "wwwtom-crm", domain: stageHost(stage, "crm") }
      : { name: `wwwtom-crm-${stage}`, domain: stageHost(stage, "crm") }),
    env: {
      NODE_ENV: "production",
      VITE_ADAPTER_URL: isAlchemyDev ? "http://localhost:8788" : `https://${adapterHost}`,
      VITE_AUTH_PROVIDER: "github",
    },
  });
});

export default Stack(
  "wwwtom-crm",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()) as never,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const app = yield* crm;
    yield* previewComment({ name: "mono CRM", url: app.url });
    return { url: app.url };
  }),
);

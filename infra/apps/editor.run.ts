import * as Cloudflare from "alchemy/Cloudflare";
import { ALCHEMY_DEV } from "alchemy";
import { Effect, Layer } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { stageHost } from "../shared.run.ts";

const rootDir = `${import.meta.dirname}/../../apps/editor`;

export const editor = Effect.gen(function* () {
  const stage = yield* Stage;
  const isAlchemyDev = yield* ALCHEMY_DEV;
  const adapterHost = stageHost(stage, "adapter");

  // Static Vite SPA (no server runtime): the only env it needs is the
  // adapter origin inlined at build time for API calls.
  return yield* Cloudflare.Website.Vite("wwwtom-editor", {
    rootDir,
    compatibility: { flags: ["nodejs_compat"] },
    ...(stage === "production"
      ? { name: "wwwtom-editor", domain: stageHost(stage, "cms") }
      : { name: `wwwtom-editor-${stage}`, domain: stageHost(stage, "cms") }),
    env: {
      NODE_ENV: "production",
      VITE_ADAPTER_URL: isAlchemyDev ? "http://localhost:8788" : `https://${adapterHost}`,
    },
  });
});

export default Stack(
  "wwwtom-editor",
  {
    providers: Layer.mergeAll(Cloudflare.providers()) as never,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const app = yield* editor;

    return {
      url: app.url,
    };
  }),
);

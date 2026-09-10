import * as Cloudflare from "alchemy/Cloudflare";
import * as GitHub from "alchemy/GitHub";
import { ALCHEMY_DEV } from "alchemy";
import { Effect, Layer } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { stageHost } from "../shared.run.ts";
import { previewComment } from "../utils/github/preview-comment.ts";

const rootDir = `${import.meta.dirname}/../../apps/editor`;

export const editor = Effect.gen(function* () {
  const stage = yield* Stage;
  const isAlchemyDev = yield* ALCHEMY_DEV;
  // PR preview editors authenticate through the dev adapter: OAuth
  // redirect URIs are exact-match at GitHub, so per-PR hosts can never be
  // registered. The dev API trusts each PR's editor origin (see
  // previewEditorOrigins in apps/api/src/services/auth.ts).
  const adapterHost = stage.startsWith("pr-")
    ? stageHost("dev", "adapter")
    : stageHost(stage, "adapter");

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
      // Tom editor build: GitHub auth with the full CMS (posts + works).
      VITE_AUTH_PROVIDER: "github",
      VITE_SOPHIE: "false",
    },
  });
});

export default Stack(
  "wwwtom-editor",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()) as never,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const app = yield* editor;
    yield* previewComment({ name: "Tom CMS", url: app.url });

    return {
      url: app.url,
    };
  }),
);

import * as Cloudflare from "alchemy/Cloudflare";
import { ALCHEMY_DEV } from "alchemy";
import { Effect, Layer } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { sophieStageHost, sophieWebHost } from "../shared.run.ts";

const rootDir = `${import.meta.dirname}/../..`;

export const sophieWeb = Effect.gen(function* () {
  const stage = yield* Stage;
  const isAlchemyDev = yield* ALCHEMY_DEV;
  const adapterHost = sophieStageHost(stage, "adapter");

  // SSR Sophie blog frontend (posts plus categories, TomUI). No SPA
  // fallback: deep links like /posts/:slug server-render crawler meta.
  return yield* Cloudflare.Website.Vite("sophie-web", {
    rootDir: `${rootDir}/apps/sophie`,
    compatibility: { flags: ["nodejs_compat"] },
    ...(stage === "production"
      ? { name: "sophie-web", domain: sophieWebHost(stage) }
      : { name: `sophie-web-${stage}`, domain: sophieWebHost(stage) }),
    env: {
      NODE_ENV: "production",
      VITE_ADAPTER_URL: isAlchemyDev ? "http://localhost:8790" : `https://${adapterHost}`,
      // Runtime adapter origin for server-side data fetching.
      ADAPTER_URL: isAlchemyDev ? "http://localhost:8790" : `https://${adapterHost}`,
    },
  });
});

export const sophieEditor = Effect.gen(function* () {
  const stage = yield* Stage;
  const isAlchemyDev = yield* ALCHEMY_DEV;
  const adapterHost = sophieStageHost(stage, "adapter");

  // Same Camus SPA code as Tom CMS, with Google auth only plus Sophie
  // adapter origin inlined at build time.
  return yield* Cloudflare.Website.Vite("sophie-editor", {
    rootDir: `${rootDir}/apps/editor`,
    compatibility: { flags: ["nodejs_compat"] },
    ...(stage === "production"
      ? { name: "sophie-editor", domain: sophieStageHost(stage, "cms") }
      : { name: `sophie-editor-${stage}`, domain: sophieStageHost(stage, "cms") }),
    env: {
      NODE_ENV: "production",
      VITE_ADAPTER_URL: isAlchemyDev ? "http://localhost:8790" : `https://${adapterHost}`,
      VITE_AUTH_PROVIDER: "google",
      // Sophie Camus manages posts only: the editor hides the Works toggle.
      VITE_SOPHIE: "true",
    },
  });
});

export default Stack(
  "sophie",
  {
    providers: Layer.mergeAll(Cloudflare.providers()) as never,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const web = yield* sophieWeb;
    const editor = yield* sophieEditor;

    return {
      url: web.url,
      editorUrl: editor.url,
    };
  }),
);

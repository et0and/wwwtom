import * as Cloudflare from "@alchemy.run/cloudflare";
import * as GitHub from "@alchemy.run/github";
import { Effect, Layer } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { stageHost } from "../shared.run.ts";
import { previewComment } from "../utils/github/preview-comment.ts";

const rootDir = `${import.meta.dirname}/../..`;

export const storybook = Effect.gen(function* () {
  const stage = yield* Stage;

  // Static Storybook build (no server runtime): Alchemy runs the
  // storybook build and uploads the static output as Worker assets.
  return yield* Cloudflare.Website.StaticSite("wwwtom-storybook", {
    cwd: rootDir,
    command: "pnpm --filter @tom/storybook build",
    outdir: "packages/ui/src/storybook/storybook-static",
    compatibility: { flags: ["nodejs_compat"] },
    // Only the custom domain: workers.dev would bypass the zone edge rules.
    workersDev: false,
    ...(stage === "production"
      ? { name: "wwwtom-storybook", domain: stageHost(stage, "storybook") }
      : { name: `wwwtom-storybook-${stage}`, domain: stageHost(stage, "storybook") }),
    env: {
      NODE_ENV: "production",
    },
    dev: {
      command: "pnpm --filter @tom/storybook storybook",
    },
  });
});

export default Stack(
  "wwwtom-storybook",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), GitHub.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const stage = yield* Stage;
    const app = yield* storybook;
    yield* previewComment({
      id: "wwwtom-storybook-preview",
      apps: [{ name: "Storybook", url: `https://${stageHost(stage, "storybook")}` }],
    });

    return {
      url: app.url,
    };
  }),
);

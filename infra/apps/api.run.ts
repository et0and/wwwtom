import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { stageHost, tomSecrets } from "../shared.run.ts";

const rootDir = `${import.meta.dirname}/../..`;

export const api = Effect.gen(function* () {
  const stage = yield* Stage;

  return yield* Cloudflare.Worker("wwwtom-api", {
    main: `${rootDir}/apps/api/src/index.ts`,
    compatibility: { date: "2025-12-10" },
    // Every stage gets a deterministic worker name and custom domain so other
    // stacks can reference it (production adopts the existing worker).
    ...(stage === "production"
      ? { name: "apitom", domain: stageHost(stage, "api") }
      : { name: `wwwtom-api-${stage}`, domain: stageHost(stage, "api") }),
    env: {
      NODE_ENV: "production",
      TOM_SECRETS: tomSecrets,
    },
  });
});

export default Stack(
  "wwwtom-api",
  {
    providers: Cloudflare.providers() as never,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const worker = yield* api;

    return {
      url: worker.url,
    };
  }),
);

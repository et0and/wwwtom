import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { tomSecrets } from "../shared.run.ts";

const rootDir = `${import.meta.dirname}/../..`;

export const api = Effect.gen(function* () {
  const stage = yield* Stage;

  return yield* Cloudflare.Worker("wwwtom-api", {
    main: `${rootDir}/apps/api/src/index.ts`,
    compatibility: { date: "2025-12-10" },
    // Adopt the existing production Worker and keep its custom domain.
    ...(stage === "production" ? { name: "apitom", domain: "api.tom.so" } : {}),
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

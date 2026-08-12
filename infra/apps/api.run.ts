import * as Cloudflare from "alchemy/Cloudflare";
import { ALCHEMY_DEV } from "alchemy";
import { Effect, Option, Schema } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { stageHost, tomSecrets } from "../shared.run.ts";
import { tomQueue } from "../queues/tom.queue.ts";
import { TomSecretsSchema } from "@tom/schemas/secrets";

const rootDir = `${import.meta.dirname}/../..`;

export const api = Effect.gen(function* () {
  const stage = yield* Stage;
  const isAlchemyDev = yield* ALCHEMY_DEV;

  // Secrets Store bindings are not supported in local workerd mode, so under
  // `alchemy dev` the TOM_SECRETS bundle is split into plain vars instead.
  const devSecrets: Record<string, string> = {};
  if (isAlchemyDev) {
    const bundle = process.env.TOM_SECRETS;
    if (bundle) {
      const parsed = Schema.decodeUnknownOption(TomSecretsSchema)(bundle);
      if (Option.isSome(parsed)) Object.assign(devSecrets, parsed.value);
    }
  }

  return yield* Cloudflare.Worker("wwwtom-api", {
    main: `${rootDir}/apps/api/src/index.ts`,
    compatibility: { date: "2025-12-10" },
    dev: {
      // Local workerd dev server via `alchemy dev`; API_URL points back at it.
      port: 8787,
    },
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: true },
      traces: { enabled: true, headSamplingRate: 1 },
    },
    // Every stage gets a deterministic worker name and custom domain so other
    // stacks can reference it (production adopts the existing worker).
    ...(stage === "production"
      ? { name: "apitom", domain: stageHost(stage, "api") }
      : { name: `wwwtom-api-${stage}`, domain: stageHost(stage, "api") }),
    env: {
      NODE_ENV: "production",
      ...devSecrets,
      ...(isAlchemyDev ? {} : { TOM_SECRETS: tomSecrets }),
      WORK_QUEUE: tomQueue,
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

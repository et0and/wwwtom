import * as Cloudflare from "alchemy/Cloudflare";
import { ALCHEMY_DEV } from "alchemy";
import { Effect, Option, Schema } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { retain } from "alchemy/RemovalPolicy";
import { stageHost, stageWebHost, tomSecrets } from "../shared.run.ts";
import { webHyperdrive } from "../hyperdrive/web.hyperdrive.ts";
import { tomQueue } from "../queues/tom.queue.ts";
import { TomSecretsSchema } from "@tom/schemas/secrets";

const rootDir = `${import.meta.dirname}/../..`;

export const adapter = Effect.gen(function* () {
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

  // The Axiom ingest token is minted by the shared stack (production only);
  // reference it there instead of re-registering, which would fight over
  // dataset ownership. Secrets Store bindings are unsupported in local
  // workerd mode, so skip the ref under `alchemy dev`.
  const axiomToken =
    stage === "production" && !isAlchemyDev
      ? yield* Cloudflare.SecretsStore.Secret.ref("AXIOM_TOKEN", { stack: "wwwtom" })
      : undefined;

  return yield* Cloudflare.Worker("wwwtom-adapter", {
    main: `${rootDir}/apps/adapter/src/index.ts`,
    compatibility: { date: "2025-12-10", flags: ["nodejs_compat"] },
    dev: {
      // Local workerd dev server via `alchemy dev`; ADAPTER_URL points back at it.
      port: 8788,
    },
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: true },
      traces: { enabled: true, headSamplingRate: 1 },
    },
    // Every stage gets a deterministic worker name and custom domain so other
    // stacks can reference it (production adopts the existing worker).
    ...(stage === "production"
      ? { name: "wwwtom-adapter", domain: stageHost(stage, "adapter") }
      : { name: `wwwtom-adapter-${stage}`, domain: stageHost(stage, "adapter") }),
    env: {
      NODE_ENV: "production",
      ...devSecrets,
      WORK_QUEUE: tomQueue.pipe(retain()),
      ...(isAlchemyDev
        ? undefined
        : {
            TOM_SECRETS: tomSecrets,
            HYPERDRIVE: webHyperdrive,
          }),
      ...(axiomToken && { AXIOM_TOKEN: axiomToken }),
      ...(isAlchemyDev
        ? {
            ADAPTER_URL: "http://localhost:8788",
            API_URL: "http://localhost:8787",
            GUESTBOOK_RETURN_URL: "http://localhost:3000/guestbook",
          }
        : {
            ADAPTER_URL: `https://${stageHost(stage, "adapter")}`,
            API_URL: `https://${stageHost(stage, "api")}`,
            GUESTBOOK_RETURN_URL: `https://${stageWebHost(stage)}/guestbook`,
          }),
    },
  });
});

export default Stack(
  "wwwtom-adapter",
  {
    providers: Cloudflare.providers() as never,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const worker = yield* adapter;

    return {
      url: worker.url,
    };
  }),
);

import * as Cloudflare from "alchemy/Cloudflare";
import { ALCHEMY_DEV } from "alchemy";
import { Effect, Option, Schema } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { retain } from "alchemy/RemovalPolicy";
import { stageHost, tomSecrets } from "../shared.run.ts";
import { tomQueue, tomQueueDlq } from "../queues/tom.queue.ts";
import { cmsD1, cmsMediaBucket, previewCmsD1, previewCmsMedia } from "../cms/cms.storage.ts";
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

  // The Axiom ingest token is minted by the shared stack (production only);
  // reference it there instead of re-registering, which would fight over
  // dataset ownership. Secrets Store bindings are unsupported in local
  // workerd mode, so skip the ref under `alchemy dev`.
  const axiomToken =
    stage === "production" && !isAlchemyDev
      ? yield* Cloudflare.SecretsStore.Secret.ref("AXIOM_TOKEN", { stack: "wwwtom" })
      : undefined;

  // The shared stack owns the queue lifecycle; this copy stays retained so a
  // preview destroy never deletes the queue while sibling workers still bind
  // it (see infra/queues/tom.queue.ts).
  const queue = yield* tomQueue.pipe(retain());
  const dlq = yield* tomQueueDlq.pipe(retain());

  // The CMS D1 database and media bucket are owned by the api stack, the
  // only runtime user. Production retains them so a stage teardown never
  // deletes content or media; preview stages stay ephemeral. PR previews
  // read the dev database + bucket directly (see cms.storage.ts).
  const cmsDb = yield* stage === "production"
    ? cmsD1.pipe(retain())
    : stage.startsWith("pr-")
      ? previewCmsD1
      : cmsD1;
  const cmsMedia = yield* stage === "production"
    ? cmsMediaBucket.pipe(retain())
    : stage.startsWith("pr-")
      ? previewCmsMedia
      : cmsMediaBucket;

  const worker = yield* Cloudflare.Worker("wwwtom-api", {
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
      TOM_STAGE: stage,
      ...devSecrets,
      ...(isAlchemyDev ? undefined : { TOM_SECRETS: tomSecrets }),
      ...(axiomToken && { AXIOM_TOKEN: axiomToken }),
      WORK_QUEUE: queue,
      CMS_D1: cmsDb,
      CMS_MEDIA: cmsMedia,
      // Better Auth builds OAuth redirect URLs from the adapter origin and
      // only returns to trusted editor origins after sign-in.
      ADAPTER_URL: isAlchemyDev
        ? "http://localhost:8788"
        : `https://${stageHost(stage, "adapter")}`,
      EDITOR_URL: isAlchemyDev ? "http://localhost:5173" : `https://${stageHost(stage, "cms")}`,
    },
  });

  // The api worker hosts the single worker consumer (at most one per queue):
  // it drains tom-work-queue via the `queue` handler in apps/api/src/index.ts;
  // exhausted messages route to the DLQ.
  yield* Cloudflare.Queues.Consumer("tom-work-consumer", {
    queueId: queue.queueId,
    scriptName: worker.workerName,
    deadLetterQueue: dlq.queueName,
    settings: { batchSize: 10, maxRetries: 3, maxWaitTimeMs: 5000 },
  });

  return worker;
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

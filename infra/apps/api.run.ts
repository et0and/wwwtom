import * as Cloudflare from "alchemy/Cloudflare";
import { ALCHEMY_DEV } from "alchemy";
import { Effect } from "effect";
import { ConfigError } from "effect/Config";
import { SourceError } from "effect/ConfigProvider";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { retain } from "alchemy/RemovalPolicy";
import { resolveDeploySecrets } from "./api.secrets.ts";
import { stageHost, sophieStageHost, tomSecrets } from "../shared.run.ts";
import { tomQueue, tomQueueDlq } from "../queues/tom.queue.ts";
import { sophieQueue, sophieQueueDlq } from "../queues/sophie.queue.ts";
import { cmsD1, cmsMediaBucket, previewCmsD1, previewCmsMedia } from "../cms/cms.storage.ts";
import { sophieD1, sophieMediaBucket } from "../cms/sophie.storage.ts";

const rootDir = `${import.meta.dirname}/../..`;

export const api = Effect.gen(function* () {
  const stage = yield* Stage;
  const isAlchemyDev = yield* ALCHEMY_DEV;
  const {
    tomDevSecrets,
    sophieDevSecrets,
    tomAdminEmails,
    sophieAdminEmails,
    sophieGoogleClientId,
    sophieGoogleClientSecret,
  } = yield* resolveDeploySecrets(isAlchemyDev);

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
    // OG fonts ship as static files (apps/api/public/fonts) served by the
    // worker itself; the OG service fetches them from its own origin.
    assets: { directory: `${rootDir}/apps/api/public` },
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
      TENANT: "tom",
      // GitHub-only OAuth for this worker (runtime-enforced allowlist).
      CMS_AUTH_PROVIDERS: "github",
      ...tomDevSecrets,
      ...(isAlchemyDev ? undefined : { TOM_SECRETS: tomSecrets }),
      ...(axiomToken && { AXIOM_TOKEN: axiomToken }),
      WORK_QUEUE: queue,
      CMS_D1: cmsDb,
      CMS_MEDIA: cmsMedia,
      // Admin allowlist as explicit stage config (deploy-time env or
      // bundle, never code): it wins over the opaque shared bundle value.
      CMS_ADMIN_EMAILS: tomAdminEmails,
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

  // Sophie CMS reuses the same API code with isolated storage (D1, media,
  // queue). Production retains Sophie data; preview stages stay ephemeral.
  // Google is the only OAuth provider: the dev split strips GITHUB_* keys
  // and CMS_AUTH_PROVIDERS enforces google-only at runtime. The allowlist
  // resolves from deploy-time env or the SOPHIE_CMS_ADMIN_EMAILS bundle
  // key; /works/* writes are rejected for this tenant (cms-writes).
  const sophieDb = yield* stage === "production" ? sophieD1.pipe(retain()) : sophieD1;
  const sophieMedia = yield* stage === "production"
    ? sophieMediaBucket.pipe(retain())
    : sophieMediaBucket;

  // The Sophie queue is owned by this stack and retained by the adapter
  // stack (see adapter.run.ts): destroy runs adapter before api (see the
  // root destroy chain), so the queue is deletable by the time this stack
  // tears down. Tenant-scoped names keep Tom jobs out of it.
  const sophieWorkQueue = yield* sophieQueue;
  const sophieDlq = yield* sophieQueueDlq;

  const sophieWorker = yield* Cloudflare.Worker("sophie-api", {
    main: `${rootDir}/apps/api/src/index.ts`,
    compatibility: { date: "2025-12-10" },
    assets: { directory: `${rootDir}/apps/api/public` },
    dev: {
      port: 8789,
    },
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: true },
      traces: { enabled: true, headSamplingRate: 1 },
    },
    ...(stage === "production"
      ? { name: "sophie-api", domain: sophieStageHost(stage, "api") }
      : { name: `sophie-api-${stage}`, domain: sophieStageHost(stage, "api") }),
    env: {
      NODE_ENV: "production",
      TOM_STAGE: stage,
      TENANT: "sophie",
      // Google-only OAuth for this worker (runtime-enforced allowlist).
      CMS_AUTH_PROVIDERS: "google",
      ...sophieDevSecrets,
      ...(isAlchemyDev ? undefined : { TOM_SECRETS: tomSecrets }),
      ...(axiomToken && { AXIOM_TOKEN: axiomToken }),
      WORK_QUEUE: sophieWorkQueue,
      CMS_D1: sophieDb,
      CMS_MEDIA: sophieMedia,
      // Admin allowlist as explicit stage config (deploy-time env or
      // bundle, never code): it wins over the opaque shared bundle value.
      CMS_ADMIN_EMAILS: sophieAdminEmails,
      // Google OAuth keys, explicit for the same reason (see above).
      GOOGLE_CLIENT_ID: sophieGoogleClientId,
      GOOGLE_CLIENT_SECRET: sophieGoogleClientSecret,
      ADAPTER_URL: isAlchemyDev
        ? "http://localhost:8790"
        : `https://${sophieStageHost(stage, "adapter")}`,
      EDITOR_URL: isAlchemyDev
        ? "http://localhost:5174"
        : `https://${sophieStageHost(stage, "cms")}`,
    },
  });

  // The Sophie worker drains its own queue; exhausted messages route to
  // the Sophie DLQ. The consumer runs under the Sophie worker env
  // (TENANT=sophie), so tenant jobs never cross into the Tom consumer.
  yield* Cloudflare.Queues.Consumer("sophie-work-consumer", {
    queueId: sophieWorkQueue.queueId,
    scriptName: sophieWorker.workerName,
    deadLetterQueue: sophieDlq.queueName,
    settings: { batchSize: 10, maxRetries: 3, maxWaitTimeMs: 5000 },
  });

  return { worker, sophieWorker };
});

export default Stack(
  "wwwtom-api",
  {
    providers: Cloudflare.providers() as never,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const { worker, sophieWorker } = yield* api;

    return {
      url: worker.url,
      sophieUrl: sophieWorker.url,
    };
  }).pipe(
    Effect.mapError(
      (error) => new ConfigError(new SourceError({ message: error.message, cause: error })),
    ),
  ),
);

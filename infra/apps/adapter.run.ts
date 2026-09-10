import * as Cloudflare from "alchemy/Cloudflare";
import { ALCHEMY_DEV } from "alchemy";
import { Effect, Option, Schema } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { retain } from "alchemy/RemovalPolicy";
import {
  stageHost,
  stageWebHost,
  sophieStageHost,
  sophieWebHost,
  tomSecrets,
} from "../shared.run.ts";
import { webHyperdrive } from "../hyperdrive/web.hyperdrive.ts";
import { tomQueue } from "../queues/tom.queue.ts";
import { sophieQueue } from "../queues/sophie.queue.ts";
import { TomSecretsSchema } from "@tom/schemas/secrets";

const rootDir = `${import.meta.dirname}/../..`;

// Bundle-only keys never reach worker env as separate vars: each worker
// gets the resolved value under the shared name (dev split) or via runtime
// selection from the TOM_SECRETS binding (production, readCloudflareEnv).
const TENANT_BUNDLE_KEYS = [
  "TOM_BETTER_AUTH_SECRET",
  "SOPHIE_BETTER_AUTH_SECRET",
  "TOM_INTERNAL_API_TOKEN",
  "SOPHIE_INTERNAL_API_TOKEN",
  "TOM_CMS_ADMIN_EMAILS",
  "SOPHIE_CMS_ADMIN_EMAILS",
];

/** Drop keys from a secret record (per-tenant isolation). */
const stripKeys = (
  secrets: Record<string, string>,
  keys: ReadonlyArray<string>,
): Record<string, string> =>
  Object.fromEntries(Object.entries(secrets).filter(([key]) => !keys.includes(key)));

/** Resolved value under the shared name, for the dev split only. */
const devSecretOverride = (name: string, value: string | undefined): Record<string, string> =>
  value === undefined ? {} : { [name]: value };

export const adapter = Effect.gen(function* () {
  const stage = yield* Stage;
  const isAlchemyDev = yield* ALCHEMY_DEV;

  // Deploy-time copy of the TOM_SECRETS bundle (when present), for the
  // dev split below. Secrets Store bindings are not supported in local
  // workerd mode, so under `alchemy dev` the bundle is split into plain
  // vars instead.
  const deployBundle: Record<string, string> = {};
  const rawBundle = process.env.TOM_SECRETS;
  if (rawBundle) {
    const parsed = Schema.decodeUnknownOption(TomSecretsSchema)(rawBundle);
    if (Option.isSome(parsed)) Object.assign(deployBundle, parsed.value);
  }

  // Per-tenant isolation for the dev split: neither adapter mints sessions
  // or OAuth flows itself, so both drop the provider keys and
  // BETTER_AUTH_SECRET entirely; each keeps only its own INTERNAL_API_TOKEN
  // (per-tenant bundle key with fallback to the shared value, so existing
  // deploys keep working). In production the shared bundle rides the
  // TOM_SECRETS binding and TENANT selects the token at runtime
  // (readCloudflareEnv), so a stray token can never cross tenants.
  const adapterDevSecrets: Record<string, string> = isAlchemyDev
    ? {
        ...stripKeys(deployBundle, [
          "GITHUB_CLIENT_ID",
          "GITHUB_CLIENT_SECRET",
          "GOOGLE_CLIENT_ID",
          "GOOGLE_CLIENT_SECRET",
          "BETTER_AUTH_SECRET",
          ...TENANT_BUNDLE_KEYS,
        ]),
        ...devSecretOverride("INTERNAL_API_TOKEN", deployBundle.TOM_INTERNAL_API_TOKEN),
      }
    : {};
  const sophieAdapterDevSecrets: Record<string, string> = isAlchemyDev
    ? {
        ...stripKeys(deployBundle, [
          "GITHUB_CLIENT_ID",
          "GITHUB_CLIENT_SECRET",
          "GOOGLE_CLIENT_ID",
          "GOOGLE_CLIENT_SECRET",
          "BETTER_AUTH_SECRET",
          ...TENANT_BUNDLE_KEYS,
        ]),
        ...devSecretOverride("INTERNAL_API_TOKEN", deployBundle.SOPHIE_INTERNAL_API_TOKEN),
      }
    : {};

  // The Axiom ingest token is minted by the shared stack (production only);
  // reference it there instead of re-registering, which would fight over
  // dataset ownership. Secrets Store bindings are unsupported in local
  // workerd mode, so skip the ref under `alchemy dev`.
  const axiomToken =
    stage === "production" && !isAlchemyDev
      ? yield* Cloudflare.SecretsStore.Secret.ref("AXIOM_TOKEN", { stack: "wwwtom" })
      : undefined;

  const worker = yield* Cloudflare.Worker("wwwtom-adapter", {
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
      // Local workerd trusts localhost editors and clears `secure` cookies;
      // deployed stages gate both on NODE_ENV.
      NODE_ENV: isAlchemyDev ? "development" : "production",
      TOM_STAGE: stage,
      TENANT: "tom",
      ...adapterDevSecrets,
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

  // Sophie adapter reuses the same worker code with Sophie URLs. One deploy
  // ships both adapters; no separate stack or duplicated setup lives here.
  // The Sophie worker binds the Sophie queue and Hyperdrive (never the Tom
  // ones), so guestbook jobs and database traffic stay tenant-scoped.
  const sophieWorker = yield* Cloudflare.Worker("sophie-adapter", {
    main: `${rootDir}/apps/adapter/src/index.ts`,
    compatibility: { date: "2025-12-10", flags: ["nodejs_compat"] },
    dev: {
      port: 8790,
    },
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: true },
      traces: { enabled: true, headSamplingRate: 1 },
    },
    ...(stage === "production"
      ? { name: "sophie-adapter", domain: sophieStageHost(stage, "adapter") }
      : { name: `sophie-adapter-${stage}`, domain: sophieStageHost(stage, "adapter") }),
    env: {
      NODE_ENV: isAlchemyDev ? "development" : "production",
      TOM_STAGE: stage,
      TENANT: "sophie",
      ...sophieAdapterDevSecrets,
      // Retained copy of the Sophie queue: the api stack owns its
      // lifecycle (see api.run.ts), so this destroy skips the delete.
      WORK_QUEUE: sophieQueue.pipe(retain()),
      ...(isAlchemyDev
        ? undefined
        : {
            TOM_SECRETS: tomSecrets,
          }),
      ...(axiomToken && { AXIOM_TOKEN: axiomToken }),
      ...(isAlchemyDev
        ? {
            ADAPTER_URL: "http://localhost:8790",
            API_URL: "http://localhost:8789",
            GUESTBOOK_RETURN_URL: "http://localhost:3001/guestbook",
          }
        : {
            ADAPTER_URL: `https://${sophieStageHost(stage, "adapter")}`,
            API_URL: `https://${sophieStageHost(stage, "api")}`,
            GUESTBOOK_RETURN_URL: `https://${sophieWebHost(stage)}/guestbook`,
          }),
    },
  });

  return { worker, sophieWorker };
});

export default Stack(
  "wwwtom-adapter",
  {
    providers: Cloudflare.providers() as never,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const { worker, sophieWorker } = yield* adapter;

    return {
      url: worker.url,
      sophieUrl: sophieWorker.url,
    };
  }),
);

import { adopt } from "alchemy/AdoptPolicy";
import * as Axiom from "alchemy/Axiom";
import * as Cloudflare from "alchemy/Cloudflare";
import { retain } from "alchemy/RemovalPolicy";
import { Effect, Layer, Redacted, Schema } from "effect";
import { ConfigError } from "effect/Config";
import { SourceError } from "effect/ConfigProvider";
import { InfrastructureConfigError } from "@tom/types/errors";
import { TomSecretsSchema } from "@tom/schemas/secrets";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { tomQueue, tomQueueDlq } from "./queues/tom.queue.ts";

export const readSecretBundle = (
  name: string,
): Effect.Effect<Record<string, string>, InfrastructureConfigError> =>
  Effect.gen(function* () {
    const value = process.env[name];
    if (!value) {
      return yield* new InfrastructureConfigError({
        variable: name,
        message: `${name} is required to seed Cloudflare Secrets Store`,
      });
    }

    return yield* Effect.try({
      try: () => Schema.decodeUnknownSync(TomSecretsSchema)(value),
      catch: (cause) =>
        new InfrastructureConfigError({
          variable: name,
          message: `${name} must be a JSON object of string values`,
          cause,
        }),
    });
  });

export const requireJsonSecret = (name: string): Effect.Effect<string, InfrastructureConfigError> =>
  Effect.map(readSecretBundle(name), () => process.env[name]!);

export const secretsStore = Cloudflare.SecretsStore.Store("wwwtom-secrets");

/**
 * Deterministic hostname for a per-stage app subdomain.
 * Production uses the bare subdomain (adapter.tom.so); other stages are
 * prefixed with the stage name (dev-adapter.tom.so).
 */
export const stageHost = (stage: string, sub: string): string =>
  stage === "production" ? `${sub}.tom.so` : `${stage}-${sub}.tom.so`;

/**
 * Hostname for the web app, which is an apex domain in production.
 */
export const stageWebHost = (stage: string): string =>
  stage === "production" ? "tom.so" : `${stage}-web.tom.so`;

/**
 * Axiom datasets and ingest token for OpenTelemetry shipping, owned by the
 * production stage (see the shared stack below).
 *
 * Datasets and API tokens are org-level (one Axiom org), not stage-scoped.
 * Fixed names match the runtime defaults (`tom-traces` / `tom-logs`).
 * Declared as `otel:*` kinds: the datasets were originally created as
 * `axiom:events:v1`, but `kind` is immutable and OTLP datasets should be
 * otel-kind for proper schema/trace UI, so production deploys deliberately
 * replace them — the legacy event-kind datasets and their events are
 * deleted once, then the datasets are alchemy-owned and no replacement is
 * planned. Do NOT add `retain()` to the datasets: the engine then skips
 * the delete and the kind change never happens (the replacement is
 * absorbed into a sync of the existing events-kind dataset). The ingest
 * token stays retained so teardown never orphans a live credential.
 *
 * `adopt(true)` takes over resources a previous run (manual or another
 * stage) already owns, so the first production deploy does not fail with
 * `OwnedBySomeoneElse`.
 */
export const axiomResources = Effect.gen(function* () {
  const store = yield* secretsStore;
  const traces = yield* Axiom.Dataset("tom-traces", {
    name: "tom-traces",
    kind: "otel:traces:v1",
    description: "OpenTelemetry traces from wwwtom workers",
  });
  const logs = yield* Axiom.Dataset("tom-logs", {
    name: "tom-logs",
    kind: "otel:logs:v1",
    description: "OpenTelemetry logs from wwwtom workers",
  });
  const ingestToken = yield* Axiom.ApiToken("wwwtom-otel-ingest", {
    name: "wwwtom-otel-ingest",
    description: "OTLP ingest for the wwwtom traces and logs datasets",
    datasetCapabilities: {
      "tom-traces": { ingest: ["create"] },
      "tom-logs": { ingest: ["create"] },
    },
  }).pipe(retain());
  // Workers bind this same store key across stacks via
  // Cloudflare.SecretsStore.Secret.ref("AXIOM_TOKEN", { stack: "wwwtom" });
  // the runtime resolves the binding in readCloudflareEnv. AXIOM_TOKEN no
  // longer lives in the TOM_SECRETS bundle.
  const axiomToken = yield* Cloudflare.SecretsStore.Secret("AXIOM_TOKEN", {
    store,
    value: ingestToken.token,
    comment: "wwwtom OTLP ingest token minted by the Axiom provider",
  }).pipe(retain());

  return { traces, logs, ingestToken, axiomToken };
}).pipe(adopt(true));

export const tomSecrets = Effect.gen(function* () {
  const store = yield* secretsStore;

  // The Secrets Store is account-level (one per account) and shared by
  // every stage, so this bundle is NOT stage-scoped. Retain it on teardown
  // so a per-stage `alchemy destroy` (e.g. the PR-preview cleanup) never
  // deletes the production TOM_SECRETS secret. The Store itself is already
  // never deleted by its provider.
  return yield* Cloudflare.SecretsStore.Secret("TOM_SECRETS", {
    store,
    value: Redacted.make(yield* requireJsonSecret("TOM_SECRETS")),
    comment: "wwwtom secret bundle as a JSON object",
  }).pipe(retain());
});

export default Stack(
  "wwwtom",
  {
    providers: Layer.provideMerge(Cloudflare.providers(), Axiom.providers()) as never,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const stage = yield* Stage;
    const [store, secrets, queue, dlq] = yield* Effect.all([
      secretsStore,
      tomSecrets,
      tomQueue,
      tomQueueDlq,
    ]);

    // The Axiom resources are org-level and can only have one owner, so only
    // production registers them; other stages would fight over ownership on
    // every deploy (and per-stage teardown could adopt-or-fail non-
    // production runs). Production additionally adopts pre-existing datasets.
    const axiom = stage === "production" ? yield* axiomResources : undefined;

    return {
      secretsStore: store.storeName,
      tomSecrets: secrets.secretName,
      tomQueue: queue.queueName,
      tomQueueDlq: dlq.queueName,
      ...(axiom && {
        axiom: {
          traces: axiom.traces.name,
          logs: axiom.logs.name,
          ingestToken: axiom.ingestToken.name,
          axiomToken: axiom.axiomToken.secretName,
        },
      }),
    };
  }).pipe(
    Effect.mapError(
      (error) => new ConfigError(new SourceError({ message: error.message, cause: error })),
    ),
  ),
);

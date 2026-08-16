import * as Cloudflare from "alchemy/Cloudflare";
import { ALCHEMY_DEV } from "alchemy";
import { Effect, Option, Schema } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { stageHost, tomSecrets } from "../shared.run.ts";
import { TomSecretsSchema } from "@tom/schemas/secrets";

export const runner = Effect.gen(function* () {
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

  return yield* Cloudflare.Worker("wwwtom-runner", {
    main: `${import.meta.dirname}/src/index.ts`,
    compatibility: { date: "2026-08-12", flags: ["nodejs_compat"] },
    dev: {
      // Local workerd dev server via `alchemy dev`; POST /runners to test.
      // Requires Docker locally — the container image is built from ./image.
      port: 8789,
    },
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: true },
      traces: { enabled: true, headSamplingRate: 0.01 },
    },
    // Every stage gets a deterministic worker name and custom domain.
    ...(stage === "production"
      ? { name: "wwwtom-runner", domain: stageHost(stage, "runner") }
      : { name: `wwwtom-runner-${stage}`, domain: stageHost(stage, "runner") }),
    env: {
      NODE_ENV: "production",
      ...devSecrets,
      // The container-backed DO class exported by src/index.ts; className
      // defaults to the binding name, so the env key must match the export.
      Sandbox: Cloudflare.Container("Sandbox", {
        context: `${import.meta.dirname}/image`,
        instanceType: "standard-1",
        maxInstances: 5,
      }),
      GITHUB_REPOSITORY: "et0and/wwwtom",
      RUNNER_LABELS: "cloudflare-sandbox",
      ...(isAlchemyDev ? undefined : { TOM_SECRETS: tomSecrets }),
      ...(axiomToken && { AXIOM_TOKEN: axiomToken }),
    },
  });
});

export default Stack(
  "wwwtom-runner",
  {
    providers: Cloudflare.providers() as never,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const worker = yield* runner;

    return {
      url: worker.url,
    };
  }),
);

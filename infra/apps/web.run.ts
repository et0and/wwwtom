import * as Cloudflare from "@alchemy.run/cloudflare";
import { ALCHEMY_DEV } from "alchemy";
import { Effect } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import {
  releaseVersion,
  stageHost,
  stageWebHost,
  tomSecrets,
  workerObservability,
} from "../shared.run.ts";

const rootDir = `${import.meta.dirname}/../../apps/web`;

export const web = Effect.gen(function* () {
  const stage = yield* Stage;
  const isAlchemyDev = yield* ALCHEMY_DEV;
  const adapterHost = stageHost(stage, "adapter");
  const appVersion = yield* releaseVersion();

  // The Axiom ingest token is minted by the shared stack (production only);
  // reference it there instead of re-registering, which would fight over
  // dataset ownership. Secrets Store bindings are unsupported in local
  // workerd mode, so skip the ref under `alchemy dev`.
  const axiomToken =
    stage === "production" && !isAlchemyDev
      ? yield* Cloudflare.SecretsStore.Secret.ref("AXIOM_TOKEN", { stack: "wwwtom" })
      : undefined;

  return yield* Cloudflare.Website.Vite("wwwtom-web", {
    rootDir,
    compatibility: { flags: ["nodejs_compat"] },
    // Only the custom domain: workers.dev would bypass the zone edge rules.
    workersDev: false,
    observability: workerObservability,
    // Every stage gets a deterministic worker name and custom domain so the
    // adapter can redirect back to it (production adopts the existing worker).
    ...(stage === "production"
      ? { name: "wwwtom", domain: stageWebHost(stage) }
      : { name: `wwwtom-${stage}`, domain: stageWebHost(stage) }),
    env: {
      NODE_ENV: "production",
      // Part of the build inputs: a release tag only touches CHANGELOG.md, so
      // without this the web bundle is a noop and the footer keeps the old
      // version stamp. Also inlined into the client bundle (VITE_ prefix).
      VITE_APP_VERSION: appVersion,
      TOM_SECRETS: tomSecrets,
      ...(axiomToken && { AXIOM_TOKEN: axiomToken }),
      ADAPTER_URL: isAlchemyDev ? "http://localhost:8788" : `https://${adapterHost}`,
      // Inlined into the client bundle at build time (Alchemy VITE_ prefix).
      ...(isAlchemyDev ? undefined : { VITE_ADAPTER_URL: `https://${adapterHost}` }),
    },
  });
});

export default Stack(
  "wwwtom-web",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const app = yield* web;

    return {
      url: app.url,
    };
  }),
);

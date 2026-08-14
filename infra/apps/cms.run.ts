import * as Cloudflare from "alchemy/Cloudflare";
import { ALCHEMY_DEV } from "alchemy";
import { Effect } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { devSecretVars, stageHost, tomSecrets } from "../shared.run.ts";

const rootDir = `${import.meta.dirname}/../..`;

// The env vars apps/cms/src/payload.config.ts reads from process.env; under
// `alchemy dev` the TOM_SECRETS bundle is split into these as plain vars.
const cmsSecretKeys = [
  "PAYLOAD_SECRET",
  "CRON_SECRET",
  "S3_BUCKET",
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
] as const;

export const cms = Effect.gen(function* () {
  const stage = yield* Stage;
  const isAlchemyDev = yield* ALCHEMY_DEV;

  // Secrets Store bindings are not supported in local workerd mode, so under
  // `alchemy dev` the TOM_SECRETS bundle is split into plain vars instead.
  const devSecrets = isAlchemyDev ? devSecretVars(cmsSecretKeys) : {};
  const secretEnv = isAlchemyDev ? devSecrets : { TOM_SECRETS: tomSecrets };

  // Adopt the existing production database; other stages get their own.
  const db = yield* Cloudflare.D1.Database(
    "wwwtom-cms-db",
    stage === "production" ? { name: "tom-cms" } : undefined,
  );

  return yield* Cloudflare.Website.Nextjs("wwwtom-cms", {
    rootDir: `${rootDir}/apps/cms`,
    // Every stage gets a deterministic worker name and custom domain so other
    // stacks can reference it (production adopts the existing worker).
    ...(stage === "production"
      ? { name: "cmstom", domain: "cms.tom.so" }
      : { name: `wwwtom-cms-${stage}`, domain: stageHost(stage, "cms") }),
    env: {
      NODE_ENV: "production",
      NEXT_PUBLIC_SERVER_URL:
        stage === "production" ? "https://cms.tom.so" : `https://${stageHost(stage, "cms")}`,
      // Media lives in the shared S3 bucket, so the CDN origin is the same
      // for every stage.
      CDN_URL: "https://cdn.tom.so",
      D1: db,
      ...secretEnv,
    },
  });
});

export default Stack(
  "wwwtom-cms",
  {
    providers: Cloudflare.providers() as never,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const site = yield* cms;

    return {
      url: site.url,
    };
  }),
);

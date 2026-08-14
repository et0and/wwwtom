import * as Cloudflare from "alchemy/Cloudflare";
import { ALCHEMY_DEV } from "alchemy";
import { Effect } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { devSecretVars, tomSecrets } from "../shared.run.ts";

const rootDir = `${import.meta.dirname}/../..`;

export const sophie = Effect.gen(function* () {
  const stage = yield* Stage;
  const isAlchemyDev = yield* ALCHEMY_DEV;

  // Secrets Store bindings are not supported in local workerd mode, so under
  // `alchemy dev` the TOM_SECRETS bundle is split into plain vars instead.
  const devSecrets = isAlchemyDev ? devSecretVars(["PAYLOAD_SECRET"]) : {};
  const secretEnv = isAlchemyDev ? devSecrets : { TOM_SECRETS: tomSecrets };

  // Adopt the existing production resources; other stages get their own.
  const db = yield* Cloudflare.D1.Database(
    "wwwtom-sophie-db",
    stage === "production" ? { name: "sophie-cms" } : undefined,
  );
  const media = yield* Cloudflare.R2.Bucket(
    "wwwtom-sophie-media",
    stage === "production" ? { name: "sophie-media" } : undefined,
  );

  return yield* Cloudflare.Website.Nextjs("wwwtom-sophie", {
    rootDir: `${rootDir}/apps/sophie`,
    // Production adopts the existing worker. It has no custom domain today,
    // so other stages get isolated workers on workers.dev only.
    ...(stage === "production" ? { name: "sophie-cms" } : { name: `wwwtom-sophie-${stage}` }),
    env: {
      NODE_ENV: "production",
      // Media lives in the shared R2 bucket, so the CDN origin is the same
      // for every stage.
      CDN_URL: "https://cdn.sophie.st",
      D1: db,
      R2: media,
      ...secretEnv,
    },
  });
});

export default Stack(
  "wwwtom-sophie",
  {
    providers: Cloudflare.providers() as never,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const site = yield* sophie;

    return {
      url: site.url,
    };
  }),
);

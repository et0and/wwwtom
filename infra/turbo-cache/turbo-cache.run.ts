import * as Cloudflare from "alchemy/Cloudflare";
import { ALCHEMY_DEV } from "alchemy";
import { Effect, Option, Schema } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { stageHost, tomSecrets } from "../shared.run.ts";
import { turboCacheKv } from "../kv/turbo-cache.kv.ts";
import { TomSecretsSchema } from "@tom/schemas/secrets";

/**
 * KV-backed Turborepo remote cache (`turbo-cache.tom.so`). The Turbo CLI
 * uploads task artifacts to `PUT /v8/artifacts/{hash}` and restores them
 * from `GET /v8/artifacts/{hash}`; every route requires the bearer token
 * seeded in the TOM_SECRETS bundle as `TURBO_CACHE_TOKEN`.
 *
 * Set `TURBO_API=https://turbo-cache.tom.so` (custom-server URL),
 * `TURBO_TOKEN=<TURBO_CACHE_TOKEN>` and `TURBO_TEAM` in CI to share the
 * cache between runs.
 */
export const turboCache = Effect.gen(function* () {
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

  return yield* Cloudflare.Worker("wwwtom-turbo-cache", {
    main: `${import.meta.dirname}/src/index.ts`,
    compatibility: { date: "2026-08-12", flags: ["nodejs_compat"] },
    dev: {
      // Local workerd dev server via `alchemy dev`.
      port: 8790,
    },
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: true },
      traces: { enabled: true, headSamplingRate: 1 },
    },
    // Every stage gets a deterministic worker name and custom domain so other
    // stacks can reference it (production adopts the existing worker).
    ...(stage === "production"
      ? { name: "wwwtom-turbo-cache", domain: stageHost(stage, "turbo-cache") }
      : { name: `wwwtom-turbo-cache-${stage}`, domain: stageHost(stage, "turbo-cache") }),
    env: {
      NODE_ENV: "production",
      ...devSecrets,
      TURBO_CACHE_KV: turboCacheKv,
      ...(isAlchemyDev ? undefined : { TOM_SECRETS: tomSecrets }),
    },
  });
});

export default Stack(
  "wwwtom-turbo-cache",
  {
    providers: Cloudflare.providers() as never,
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const worker = yield* turboCache;

    return {
      url: worker.url,
    };
  }),
);

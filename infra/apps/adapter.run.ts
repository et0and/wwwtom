import * as Cloudflare from "alchemy/Cloudflare";
import { ALCHEMY_DEV } from "alchemy";
import { Effect } from "effect";
import { Stack } from "alchemy/Stack";
import { Stage } from "alchemy/Stage";
import { devSecretVars, stageHost, stageWebHost, tomSecrets } from "../shared.run.ts";
import { webHyperdrive } from "../hyperdrive/web.hyperdrive.ts";
import { tomQueue } from "../queues/tom.queue.ts";
import { turnstileWidget } from "../turnstile/widget.ts";

const rootDir = `${import.meta.dirname}/../..`;

export const adapter = Effect.gen(function* () {
  const stage = yield* Stage;
  const isAlchemyDev = yield* ALCHEMY_DEV;

  // Secrets Store bindings are not supported in local workerd mode, so under
  // `alchemy dev` the TOM_SECRETS bundle is split into plain vars instead.
  const devSecrets = isAlchemyDev ? devSecretVars() : {};
  const secretEnv = isAlchemyDev
    ? devSecrets
    : { TOM_SECRETS: tomSecrets, HYPERDRIVE: webHyperdrive };

  // Turnstile resolves only on deploys — local dev runs without it. The
  // widget secret backs the server-side siteverify in the guestbook sign
  // handler (deployed as a secret binding, never plain text).
  const turnstileEnv = isAlchemyDev
    ? {}
    : yield* Effect.map(turnstileWidget, (turnstile) => ({
        TURNSTILE_SECRET: turnstile.secret,
      }));

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
      ...secretEnv,
      ...turnstileEnv,
      WORK_QUEUE: tomQueue,
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

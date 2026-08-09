// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";
import { createResource, Suspense, Show } from "solid-js";
import { otelConfigFromEnv, logLevelFromEnv } from "@tom/utils/services/logging";
import type { LogContext } from "@tom/utils/services/logging";
import type { CloudflareEnv } from "@tom/utils/services/config";
import { queryClient } from "~/libs/query-client";
import { serializeDehydratedState, waitForQueriesToSettle } from "~/libs/query-dehydration";

const DehydratedQueryState = () => {
  const [state] = createResource(async () => {
    await waitForQueriesToSettle(queryClient);
    return serializeDehydratedState(queryClient);
  });
  return (
    <Suspense fallback={null}>
      <Show when={state()}>
        {(json) => (
          <script type="application/json" id="query-dehydrated-state" innerHTML={json()} />
        )}
      </Show>
    </Suspense>
  );
};

const app = createHandler(() => {
  return (
    <StartServer
      document={({ assets, children, scripts }) => (
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link rel="icon" href="/favicon.ico" />
            {assets}
          </head>
          <body>
            <div id="app">{children}</div>
            <DehydratedQueryState />
            {scripts}
          </body>
        </html>
      )}
    />
  );
});

type CloudflareContext = {
  cloudflare?: { env?: unknown; ctx?: unknown };
  logContext?: LogContext;
};

export default {
  fetch: async (request: Request, env: unknown, ctx: unknown) => {
    queryClient.clear();
    const cloudflareEnv = (env ?? {}) as CloudflareEnv;
    const otel = await otelConfigFromEnv(cloudflareEnv);
    (request as Request & { context?: CloudflareContext }).context = {
      cloudflare: { env, ctx },
      logContext: {
        serviceName: "tom-web",
        requestId: crypto.randomUUID(),
        logLevel: logLevelFromEnv(cloudflareEnv),
        ...(otel ? { otel } : {}),
      },
    };
    return app.fetch(request);
  },
};

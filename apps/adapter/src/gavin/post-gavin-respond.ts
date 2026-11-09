import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { HttpStatus } from "@tom/constants/http";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import { GavinRequestSchema } from "@tom/schemas/gavin";
import { logContextFromRequest } from "@tom/utils/worker";
import { forwardHeaders, toProxiedResponse } from "../auth/forward";
import { allowLocalOriginsForAdapter, tenantFromValue } from "../origins";
import { AdapterError, runAdapter } from "../runtime";
import { requireTrustedWriteOrigin } from "../write-origin-gate";
import { requireArenaTenant } from "../arena/shared";
import { requireAdminSession, readFrameEnv } from "../frame/shared";

const GavinRequestBodySchema = Schema.toStandardSchemaV1(GavinRequestSchema);

export const respondRoute = new Elysia().post(
  "/gavin/respond",
  async ({ request, body }) => {
    requireArenaTenant(request);
    return runAdapter(
      Effect.gen(function* () {
        const env = yield* readFrameEnv(request);
        yield* requireTrustedWriteOrigin(request, {
          adapterOrigin: env.ADAPTER_URL ?? LOCAL_SERVICE_URLS.adapter,
          allowLocalOrigins: allowLocalOriginsForAdapter(env.ADAPTER_URL),
          tenant: tenantFromValue(env.TENANT),
          exemptSafeMethods: false,
          message: "Untrusted Gavin request origin",
        });
        yield* requireAdminSession(request, env);
        const upstream = yield* Effect.tryPromise({
          try: () =>
            fetch(`${env.API_URL ?? LOCAL_SERVICE_URLS.api}/gavin/respond`, {
              method: "POST",
              headers: forwardHeaders(request.headers, env.INTERNAL_API_TOKEN),
              body: JSON.stringify(body),
              redirect: "manual",
              signal: AbortSignal.timeout(35000),
            }),
          catch: () =>
            new AdapterError({
              status: HttpStatus.BadGateway,
              message: "Gavin is unavailable",
            }),
        });
        return toProxiedResponse(upstream);
      }),
      (error) => error,
      logContextFromRequest(request, "tom-adapter"),
    );
  },
  {
    body: GavinRequestBodySchema,
    detail: {
      description: "Ask Gavin for a short reply and eye mood (admin session only)",
      tags: ["frame"],
    },
  },
);

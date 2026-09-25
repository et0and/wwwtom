import { Elysia } from "elysia";
import { Effect } from "effect";
import { HttpStatus } from "@tom/constants/http";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import { readCloudflareEnv } from "@tom/utils/services/config";
import { getRequestEnv, logContextFromRequest } from "@tom/utils/services/worker";
import type { LogContext } from "@tom/utils/services/logging";
import { AdapterError, runAdapter } from "../../config/effect";
import { allowLocalOriginsForAdapter, tenantFromValue } from "../../origins";
import { forwardHeaders, toProxiedResponse } from "../auth";
import { requireTrustedWriteOrigin } from "../write-origin-gate";

const MAX_CRM_BODY_BYTES = 50 * 1024 * 1024;

class CrmBodyTooLarge extends Error {}

const crmApi = async (request: Request) => {
  const env = await readCloudflareEnv(getRequestEnv(request));
  return {
    apiUrl: env.API_URL ?? LOCAL_SERVICE_URLS.api,
    adapterOrigin: env.ADAPTER_URL ?? LOCAL_SERVICE_URLS.adapter,
    token: env.INTERNAL_API_TOKEN,
    context: logContextFromRequest(request, "tom-adapter"),
  };
};

const readBody = (request: Request): Effect.Effect<ArrayBuffer | undefined, AdapterError> =>
  Effect.tryPromise({
    try: async () => {
      if (request.method === "GET" || request.method === "HEAD") return undefined;
      const contentLength = request.headers.get("content-length");
      if (contentLength !== null) {
        const length = Number(contentLength);
        if (!Number.isFinite(length) || length > MAX_CRM_BODY_BYTES) {
          throw new CrmBodyTooLarge();
        }
      }
      if (request.body === null) return undefined;
      const state = { bytes: 0 };
      const stream = request.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            state.bytes += chunk.byteLength;
            if (state.bytes > MAX_CRM_BODY_BYTES) {
              controller.error(new CrmBodyTooLarge());
              return;
            }
            controller.enqueue(chunk);
          },
        }),
      );
      return new Response(stream).arrayBuffer();
    },
    catch: (cause) =>
      cause instanceof CrmBodyTooLarge
        ? new AdapterError({
            status: HttpStatus.PayloadTooLarge,
            message: "CRM request too large",
          })
        : new AdapterError({
            status: HttpStatus.BadRequest,
            message: "Unreadable CRM request",
          }),
  });

const requireCrmRequestOrigin = (request: Request): Effect.Effect<void, AdapterError> => {
  if (request.method === "GET" || request.method === "HEAD") return Effect.void;
  const hasOrigin = request.headers.has("origin") || request.headers.has("referer");
  return hasOrigin
    ? Effect.void
    : Effect.fail(
        new AdapterError({
          status: HttpStatus.Forbidden,
          message: "Missing CRM origin",
        }),
      );
};

const proxyCrm = (
  request: Request,
  apiUrl: string,
  adapterOrigin: string,
  token: string | undefined,
  context: LogContext,
) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/crm/, "");
  return runAdapter(
    Effect.gen(function* () {
      yield* requireCrmRequestOrigin(request);
      yield* requireTrustedWriteOrigin(request, {
        adapterOrigin,
        allowLocalOrigins: allowLocalOriginsForAdapter(getRequestEnv(request).ADAPTER_URL),
        tenant: tenantFromValue(getRequestEnv(request).TENANT),
        exemptSafeMethods: false,
        message: "Untrusted CRM origin",
      });
      const body = yield* readBody(request);
      const baseInit: RequestInit = {
        method: request.method,
        headers: forwardHeaders(request.headers, token),
        redirect: "manual",
      };
      const requestInit: RequestInit = body === undefined ? baseInit : { ...baseInit, body };
      const upstream = yield* Effect.tryPromise({
        try: () => fetch(`${apiUrl}${path}${url.search}`, requestInit),
        catch: () =>
          new AdapterError({
            status: HttpStatus.BadGateway,
            message: "CRM unavailable",
          }),
      });
      return toProxiedResponse(upstream);
    }),
    (error) => error,
    context,
  );
};

export const crmIntegration = new Elysia({ name: "crm" }).all(
  "/crm/*",
  async ({ request }) => {
    const { apiUrl, adapterOrigin, token, context } = await crmApi(request);
    return proxyCrm(request, apiUrl, adapterOrigin, token, context);
  },
  { detail: { description: "Mono CRM proxy", tags: ["crm"] } },
);

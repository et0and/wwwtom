import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import { FrameStateUpdateSchema } from "@tom/schemas/frame-state";
import { logContextFromRequest } from "@tom/utils/worker";
import { requireArenaTenant } from "../arena/shared";
import { allowLocalOriginsForAdapter, tenantFromValue } from "../origins";
import { runAdapter } from "../runtime";
import { requireTrustedWriteOrigin } from "../write-origin-gate";
import { readFrameEnv, requireAdminSession } from "./shared";
import { saveFrameUpdate } from "./state";

const FrameStateUpdateBodySchema = Schema.toStandardSchemaV1(FrameStateUpdateSchema);

export const putFrameStateRoute = new Elysia().put(
  "/frame/state",
  async ({ request, body, set }) => {
    requireArenaTenant(request);
    const state = await runAdapter(
      Effect.gen(function* () {
        const env = yield* readFrameEnv(request);
        yield* requireTrustedWriteOrigin(request, {
          adapterOrigin: env.ADAPTER_URL ?? LOCAL_SERVICE_URLS.adapter,
          allowLocalOrigins: allowLocalOriginsForAdapter(env.ADAPTER_URL),
          tenant: tenantFromValue(env.TENANT),
          exemptSafeMethods: false,
          message: "Untrusted frame control origin",
        });
        yield* requireAdminSession(request, env);
        return yield* saveFrameUpdate(env, body);
      }),
      (error) => error,
      logContextFromRequest(request, "tom-adapter"),
    );
    set.headers["Cache-Control"] = "no-store";
    return state;
  },
  {
    body: FrameStateUpdateBodySchema,
    detail: {
      description: "Set the desk frame's mode state (admin session only)",
      tags: ["frame"],
    },
  },
);

import { Elysia } from "elysia";
import { Effect, Schema } from "effect";
import { HttpStatus } from "@tom/constants/http";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import { type FrameState } from "@tom/schemas/frame-state";
import { GavinMoodUpdateSchema } from "@tom/schemas/gavin";
import { logContextFromRequest } from "@tom/utils/worker";
import { requireArenaTenant } from "../arena/shared";
import { allowLocalOriginsForAdapter, tenantFromValue } from "../origins";
import { AdapterError, runAdapter } from "../runtime";
import { requireTrustedWriteOrigin } from "../write-origin-gate";
import { readFrameEnv, readFrameState, requireAdminSession, writeFrameState } from "./shared";

const GavinMoodUpdateBodySchema = Schema.toStandardSchemaV1(GavinMoodUpdateSchema);

export const putFrameGavinRoute = new Elysia().put(
  "/frame/gavin",
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
        const current = yield* readFrameState(env);
        if (current.mode !== "gavin") {
          return yield* new AdapterError({
            status: HttpStatus.Conflict,
            message: "Gavin mode is not active",
          });
        }
        const next: FrameState = {
          ...current,
          gavinMood: body.mood,
          updatedAt: new Date().toISOString(),
        };
        yield* writeFrameState(env, next);
        return next;
      }),
      (error) => error,
      logContextFromRequest(request, "tom-adapter"),
    );
    set.headers["Cache-Control"] = "no-store";
    return state;
  },
  {
    body: GavinMoodUpdateBodySchema,
    detail: {
      description: "Set Gavin's eye mood (admin session only)",
      tags: ["frame"],
    },
  },
);

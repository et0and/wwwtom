import { Elysia } from "elysia";
import { Effect } from "effect";
import { logContextFromRequest } from "@tom/utils/worker";
import { requireArenaTenant } from "../arena/shared";
import { runAdapter } from "../runtime";
import { readFrameEnv, readFrameState, requireAdminSession, requireDeviceToken } from "./shared";

export const getFrameStateRoute = new Elysia().get(
  "/frame/state",
  async ({ request, set }) => {
    requireArenaTenant(request);
    const state = await runAdapter(
      Effect.gen(function* () {
        const env = yield* readFrameEnv(request);
        const authorization = request.headers.get("authorization");
        if (authorization !== null && authorization.startsWith("Bearer ")) {
          yield* requireDeviceToken(request, env);
        } else {
          yield* requireAdminSession(request, env);
        }
        return yield* readFrameState(env);
      }),
      (error) => error,
      logContextFromRequest(request, "tom-adapter"),
    );
    set.headers["Cache-Control"] = "no-store";
    return state;
  },
  {
    detail: {
      description: "Read the desk frame's mode state (device token or admin session)",
      tags: ["frame"],
    },
  },
);

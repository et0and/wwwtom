import { Effect, Option, Schema } from "effect";
import { HttpStatus } from "@tom/constants/http";
import { LOCAL_SERVICE_URLS } from "@tom/constants/service-urls";
import { defaultFrameState, FrameStateSchema, type FrameState } from "@tom/schemas/frame-state";
import { isAdminEmail, parseAdminEmails } from "@tom/utils/auth";
import { readCloudflareEnv, type ResolvedCloudflareEnv } from "@tom/utils/config";
import { getRequestEnv } from "@tom/utils/worker";
import { forwardHeaders } from "../auth/forward";
import { AdapterError } from "../runtime";

const FRAME_STATE_KEY = "state";
const SESSION_TIMEOUT_MS = 5000;

/** Stored state before the UI has ever written one. */
const EPOCH = new Date(0).toISOString();

const SessionSchema = Schema.Struct({
  user: Schema.Struct({ email: Schema.String }),
});

export const readFrameEnv = (
  request: Request,
): Effect.Effect<ResolvedCloudflareEnv, AdapterError> =>
  Effect.tryPromise({
    try: () => readCloudflareEnv(getRequestEnv(request)),
    catch: () =>
      new AdapterError({
        status: HttpStatus.InternalServerError,
        message: "Failed to read frame configuration",
      }),
  });

export const readFrameState = (
  env: ResolvedCloudflareEnv,
): Effect.Effect<FrameState, AdapterError> =>
  Effect.gen(function* () {
    const kv = env.FRAME_KV;
    if (kv === undefined) {
      return yield* new AdapterError({
        status: HttpStatus.ServiceUnavailable,
        message: "Frame state storage not configured",
      });
    }
    const raw = yield* Effect.tryPromise({
      try: () => kv.get(FRAME_STATE_KEY),
      catch: () =>
        new AdapterError({
          status: HttpStatus.BadGateway,
          message: "Failed to read frame state",
        }),
    });
    if (raw === null) return defaultFrameState(EPOCH);
    return Option.getOrElse(
      Schema.decodeUnknownOption(Schema.fromJsonString(FrameStateSchema))(raw),
      () => defaultFrameState(EPOCH),
    );
  });

export const writeFrameState = (
  env: ResolvedCloudflareEnv,
  state: FrameState,
): Effect.Effect<void, AdapterError> => {
  const kv = env.FRAME_KV;
  if (kv === undefined) {
    return Effect.fail(
      new AdapterError({
        status: HttpStatus.ServiceUnavailable,
        message: "Frame state storage not configured",
      }),
    );
  }
  return Effect.tryPromise({
    try: () => kv.put(FRAME_STATE_KEY, JSON.stringify(state)),
    catch: () =>
      new AdapterError({
        status: HttpStatus.BadGateway,
        message: "Failed to write frame state",
      }),
  });
};

/** Bearer token the desk frame presents; fail closed when unset. */
export const requireDeviceToken = (
  request: Request,
  env: ResolvedCloudflareEnv,
): Effect.Effect<void, AdapterError> => {
  const expected = env.FRAME_DEVICE_TOKEN;
  const header = request.headers.get("authorization");
  if (expected === undefined || expected === "" || header !== `Bearer ${expected}`) {
    return Effect.fail(
      new AdapterError({ status: HttpStatus.Unauthorized, message: "Unauthorized" }),
    );
  }
  return Effect.void;
};

/**
 * Validate the browser session through the API's Better Auth instance. The
 * adapter has no database binding, so the API stays the single session
 * authority; the browser cookie rides the internal-token hop.
 */
export const requireAdminSession = (
  request: Request,
  env: ResolvedCloudflareEnv,
): Effect.Effect<void, AdapterError> =>
  Effect.gen(function* () {
    const apiUrl = env.API_URL ?? LOCAL_SERVICE_URLS.api;
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(`${apiUrl}/auth/get-session`, {
          headers: forwardHeaders(request.headers, env.INTERNAL_API_TOKEN),
          signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
        }),
      catch: () =>
        new AdapterError({
          status: HttpStatus.BadGateway,
          message: "Session check failed",
        }),
    });
    if (response.status === HttpStatus.Unauthorized || response.status === HttpStatus.Forbidden) {
      return yield* new AdapterError({
        status: HttpStatus.Unauthorized,
        message: "Unauthorized",
      });
    }
    if (!response.ok) {
      return yield* new AdapterError({
        status: HttpStatus.BadGateway,
        message: "Session check failed",
      });
    }
    const json = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () =>
        new AdapterError({
          status: HttpStatus.BadGateway,
          message: "Session check failed",
        }),
    });
    const session = yield* Schema.decodeUnknownEffect(Schema.NullOr(SessionSchema))(json).pipe(
      Effect.mapError(
        () => new AdapterError({ status: HttpStatus.Unauthorized, message: "Unauthorized" }),
      ),
    );
    if (session === null) {
      return yield* new AdapterError({
        status: HttpStatus.Unauthorized,
        message: "Unauthorized",
      });
    }
    const allowlist = parseAdminEmails(env.CMS_ADMIN_EMAILS);
    if (!isAdminEmail(session.user.email, allowlist)) {
      return yield* new AdapterError({
        status: HttpStatus.Forbidden,
        message: "Forbidden",
      });
    }
  });

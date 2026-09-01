import { Effect, Schema } from "effect";
import { parseFlagList, type FlagName } from "@tom/flags/registry";
import { evaluateFlags, Flags } from "@tom/flags/service";
import type { FlagEvaluation } from "@tom/flags/binding";
import { HttpStatus } from "@tom/constants/http";
import type { CloudflareEnv } from "@tom/utils/services/config";
import type { LogContext } from "@tom/utils/services/logging";
import { runEffect } from "@tom/utils/services/worker";

/**
 * The client's flag refetch endpoint (`GET /api/flags`).
 *
 * The browser sends the used-only list it needs; the worker evaluates those
 * flags through the same Effect service the rest of the site uses and
 * returns a partial snapshot, so the client never touches a binding. The
 * endpoint is same-origin (served from tom.so) — no CORS needed.
 *
 * Unknown names are dropped rather than rejected: a stale client or a typo
 * resolves missing flags to their registered defaults on the client side.
 */

const FlagEvaluationSchema = Schema.Struct({
  value: Schema.Boolean,
  variant: Schema.optional(Schema.String),
  reason: Schema.optional(Schema.String),
  errorCode: Schema.optional(Schema.String),
});

const SnapshotJson = Schema.fromJsonString(Schema.Record(Schema.String, FlagEvaluationSchema));

const ErrorJson = Schema.fromJsonString(Schema.Struct({ error: Schema.String }));

const jsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
} as const;

const errorResponse = (status: number, error: string): Response =>
  new Response(Schema.encodeSync(ErrorJson)({ error }), {
    status,
    headers: jsonHeaders,
  });

const snapshotResponse = (pairs: readonly (readonly [FlagName, FlagEvaluation])[]): Response =>
  new Response(Schema.encodeSync(SnapshotJson)(Object.fromEntries(pairs)), {
    headers: jsonHeaders,
  });

const toEvaluationContext = (context: LogContext) => {
  const attributes = {
    ...(context.userId && { userId: context.userId }),
    ...(context.sessionId && { sessionId: context.sessionId }),
  };
  return Object.keys(attributes).length > 0 ? attributes : undefined;
};

export const handleFlags = (url: URL, context: LogContext): Promise<Response> => {
  const env = process.env as CloudflareEnv;
  const binding = env.FLAGS;
  const names = parseFlagList(url.searchParams.get("flags") ?? "");

  const effect = binding
    ? evaluateFlags(names, toEvaluationContext(context)).pipe(
        Effect.provide(Flags.Binding(binding)),
        Effect.map(snapshotResponse),
        Effect.catch((error) =>
          Effect.succeed(errorResponse(HttpStatus.InternalServerError, error.message)),
        ),
      )
    : Effect.succeed(errorResponse(HttpStatus.InternalServerError, "Flags binding not configured"));

  return runEffect(effect, context);
};

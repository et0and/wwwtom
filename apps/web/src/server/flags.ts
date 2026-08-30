import { Effect } from "effect";
import { isFlagName, type FlagName } from "@tom/flags/registry";
import { evaluateFlags, Flags } from "@tom/flags/service";
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

const parseNames = (searchParams: URLSearchParams): readonly FlagName[] =>
  (searchParams.get("flags") ?? "")
    .split(",")
    .map((raw) => raw.trim())
    .filter(isFlagName);

const toEvaluationContext = (context: LogContext) => {
  const attributes = {
    ...(context.userId && { userId: context.userId }),
    ...(context.sessionId && { sessionId: context.sessionId }),
  };
  return Object.keys(attributes).length > 0 ? attributes : undefined;
};

const errorResponse = (status: number, error: string): Response =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const handleFlags = (url: URL, context: LogContext): Promise<Response> => {
  const env = process.env as CloudflareEnv;
  const binding = env.FLAGS;

  if (!binding) {
    return Promise.resolve(
      errorResponse(HttpStatus.InternalServerError, "Flags binding not configured"),
    );
  }

  const names = parseNames(url.searchParams);
  const effect = evaluateFlags(names, toEvaluationContext(context)).pipe(
    Effect.provide(Flags.Binding(binding)),
    Effect.map((pairs) => {
      const snapshot = Object.fromEntries(pairs);
      return new Response(JSON.stringify(snapshot), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }),
    Effect.catch((error) =>
      Effect.succeed(errorResponse(HttpStatus.InternalServerError, error.message)),
    ),
  );

  return runEffect(effect, context);
};

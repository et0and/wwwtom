/**
 * The evaluation seam.
 *
 * The native Workers binding (`env.FLAGS`, type `Flagship` from
 * `@cloudflare/workers-types`) is duck-typed here so the package never
 * depends on workers-types or Alchemy: any object with these methods works,
 * which is how the in-memory static layer steps in for tests and local dev.
 *
 * Evaluations never 'fail' for a missing flag or a disabled flag — the
 * provided `defaultValue` is returned instead, with a reason. Only
 * unexpected runtime failures (a misconfigured binding, network errors)
 * reject the promise.
 */

/**
 * Key-value attributes used for targeting rules. Mirrors the binding's
 * `FlagshipEvaluationContext`; values are restricted to scalars.
 */
export type FlagEvaluationContext = Record<string, string | number | boolean>;

/**
 * A resolved flag: the on/off value plus metadata about how it was decided.
 *
 * Known `reason` values: "TARGETING_MATCH", "SPLIT", "DEFAULT", "DISABLED",
 * "CACHED", "ERROR", plus the client-side sentinel "NOT_DELIVERED" when a
 * snapshot is missing a flag. Known `errorCode` values: "TYPE_MISMATCH",
 * "FLAG_NOT_FOUND", "INVALID_CONTEXT", "PARSE_ERROR", "GENERAL".
 * See https://developers.cloudflare.com/flagship/reference/evaluation-reasons/
 */
export type FlagEvaluation = {
  readonly value: boolean;
  readonly variant?: string;
  readonly reason?: string;
  readonly errorCode?: string;
};

/**
 * The minimal binding surface the service calls into. Boolean-only for now;
 * wider flag types grow this seam when they land.
 */
export interface FlagshipBinding {
  readonly getBooleanDetails: (
    flagKey: string,
    defaultValue: boolean,
    context?: FlagEvaluationContext,
  ) => Promise<FlagEvaluation>;
}
